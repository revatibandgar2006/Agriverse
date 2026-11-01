
import math

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user
import models

router = APIRouter(tags=["Weather"])

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

WEATHER_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snowfall",
    73: "Moderate snowfall",
    75: "Heavy snowfall",
    80: "Rain showers",
    81: "Moderate rain showers",
    82: "Heavy rain showers",
    85: "Snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Severe thunderstorm with hail",
}


def safe_number(value):
    if value is None:
        return None
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def describe_weather(code):
    if code is None:
        return "Unavailable"
    return WEATHER_CODES.get(int(code), "Other conditions")


@router.get("/weather")
def get_weather(
    location: str = Query(..., min_length=2, max_length=100),
    current_user: models.User = Depends(get_current_user),
):
    try:
        with httpx.Client(timeout=15.0) as client:
            geo_response = client.get(
                GEOCODING_URL,
                params={
                    "name": location.strip(),
                    "count": 1,
                    "language": "en",
                    "format": "json",
                },
            )
            geo_response.raise_for_status()
            geo_data = geo_response.json()

            places = geo_data.get("results", [])
            if not places:
                raise HTTPException(
                    status_code=404,
                    detail=f"No location found for '{location}'. Try a nearby town or city.",
                )

            place = places[0]
            latitude = safe_number(place.get("latitude"))
            longitude = safe_number(place.get("longitude"))

            if latitude is None or longitude is None:
                raise HTTPException(
                    status_code=502,
                    detail="Invalid coordinates received from the weather service.",
                )

            response = client.get(
                FORECAST_URL,
                params={
                    "latitude": latitude,
                    "longitude": longitude,
                    "current": (
                        "temperature_2m,relative_humidity_2m,"
                        "apparent_temperature,is_day,precipitation,rain,"
                        "weather_code,wind_speed_10m"
                    ),
                    "daily": (
                        "weather_code,temperature_2m_max,temperature_2m_min,"
                        "precipitation_probability_max"
                    ),
                    "timezone": "auto",
                    "forecast_days": 5,
                },
            )
            response.raise_for_status()
            data = response.json()

    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="The weather service timed out. Please try again.",
        )
    except (httpx.HTTPError, ValueError):
        raise HTTPException(
            status_code=502,
            detail="Weather data is temporarily unavailable. Please try again.",
        )

    current = data.get("current", {})
    daily = data.get("daily", {})
    forecast = []

    for i, date in enumerate(daily.get("time", [])):
        codes = daily.get("weather_code", [])
        highs = daily.get("temperature_2m_max", [])
        lows = daily.get("temperature_2m_min", [])
        rain_chances = daily.get("precipitation_probability_max", [])

        code = codes[i] if i < len(codes) else None

        forecast.append({
            "date": date,
            "weather_code": code,
            "condition": describe_weather(code),
            "temperature_max": safe_number(highs[i]) if i < len(highs) else None,
            "temperature_min": safe_number(lows[i]) if i < len(lows) else None,
            "precipitation_probability": (
                rain_chances[i] if i < len(rain_chances) else None
            ),
        })

    return {
        "location": {
            "name": place.get("name", location),
            "admin1": place.get("admin1"),
            "country": place.get("country"),
            "latitude": latitude,
            "longitude": longitude,
            "timezone": data.get("timezone"),
        },
        "current": {
            "time": current.get("time"),
            "temperature": safe_number(current.get("temperature_2m")),
            "feels_like": safe_number(current.get("apparent_temperature")),
            "humidity": current.get("relative_humidity_2m"),
            "wind_speed": safe_number(current.get("wind_speed_10m")),
            "precipitation": safe_number(current.get("precipitation")),
            "rain": safe_number(current.get("rain")),
            "weather_code": current.get("weather_code"),
            "condition": describe_weather(current.get("weather_code")),
        },
        "daily_forecast": forecast,
        "units": {
            "temperature": data.get("current_units", {}).get("temperature_2m", "°C"),
            "wind_speed": data.get("current_units", {}).get("wind_speed_10m", "km/h"),
            "precipitation": data.get("current_units", {}).get("precipitation", "mm"),
        },
        "source": "Open-Meteo",
    }
