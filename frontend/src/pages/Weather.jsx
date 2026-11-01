
import { useState } from "react";
import { getWeather } from "../services/api";
import "./Weather.css";

const WEATHER_NOTIFICATION_KEY = "agriverse_notifications";

// --------------------------------------------------
// WEATHER HELPERS
// --------------------------------------------------

function weatherIcon(code) {
  if (code === 0) return "☀️";
  if ([1, 2].includes(code)) return "🌤️";
  if (code === 3) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(code)) return "🌦️";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "🌡️";
}

function showValue(value, suffix = "") {
  if (value === null || value === undefined) {
    return "N/A";
  }

  return `${value}${suffix}`;
}

function formatDate(date) {
  if (!date) return "Date unavailable";

  const parsedDate = new Date(`${date}T12:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return parsedDate.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function readStoredNotifications() {
  try {
    const stored = localStorage.getItem(WEATHER_NOTIFICATION_KEY);
    const parsed = stored ? JSON.parse(stored) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// --------------------------------------------------
// WEATHER NOTIFICATIONS
// --------------------------------------------------

function saveWeatherAlerts(weather) {
  const locationName = weather?.location?.name || "Selected location";
  const current = weather?.current;

  const forecast = Array.isArray(weather?.daily_forecast)
    ? weather.daily_forecast
    : [];

  if (!current) return;

  const alerts = [];
  const weatherCode = Number(current.weather_code);
  const observationTime = current.time || "current";
  const units = weather.units || {};

  // Thunderstorm
  if ([95, 96, 99].includes(weatherCode)) {
    alerts.push({
      id: `weather-${locationName}-storm-${observationTime}`,
      title: "Thunderstorm Alert",
      message:
        "Thunderstorm conditions are reported. Check local weather guidance and protect vulnerable crops where practical.",
      icon: "⛈️",
      location: locationName,
    });
  }

  // Heavy rain
  if ([65, 82].includes(weatherCode)) {
    alerts.push({
      id: `weather-${locationName}-rain-${observationTime}`,
      title: "Heavy Rain Alert",
      message:
        "Heavy rain conditions are reported. Check drainage and protect vulnerable crops where practical.",
      icon: "🌧️",
      location: locationName,
    });
  }

  // High probability of precipitation
  forecast.forEach((day) => {
    const probability = Number(day.precipitation_probability);

    if (
      day.precipitation_probability !== null &&
      day.precipitation_probability !== undefined &&
      probability >= 70
    ) {
      alerts.push({
        id: `weather-${locationName}-forecast-rain-${day.date}`,
        title: "High Rain Probability",
        message: `The forecast reports a ${probability}% chance of precipitation on ${day.date}.`,
        icon: "🌦️",
        location: locationName,
      });
    }
  });

  // High wind speed
  if (
    current.wind_speed !== null &&
    current.wind_speed !== undefined &&
    Number(current.wind_speed) >= 50
  ) {
    alerts.push({
      id: `weather-${locationName}-wind-${observationTime}`,
      title: "High Wind Speed",
      message: `Reported wind speed is ${current.wind_speed} ${
        units.wind_speed || "km/h"
      }. Check local conditions and protect vulnerable crops where practical.`,
      icon: "💨",
      location: locationName,
    });
  }

  // High temperature
  if (
    current.temperature !== null &&
    current.temperature !== undefined &&
    Number.isFinite(Number(current.temperature)) &&
    Number(current.temperature) >= 40
  ) {
    alerts.push({
      id: `weather-${locationName}-heat-${observationTime}`,
      title: "High Temperature",
      message: `Reported temperature is ${current.temperature}${
        units.temperature || "°C"
      }. Consider heat precautions for people, animals, and crops.`,
      icon: "🌡️",
      location: locationName,
    });
  }

  // Always create a normal weather update when no alert threshold is met.
  // This confirms that the notification flow is working without inventing
  // a severe-weather warning when the conditions are normal.
  if (alerts.length === 0) {
    const condition = current.condition || "Current conditions are available";
    const temperature =
      current.temperature !== null && current.temperature !== undefined
        ? ` Temperature: ${current.temperature}${units.temperature || "°C"}.`
        : "";

    alerts.push({
      id: `weather-${locationName}-update-${observationTime}`,
      title: "Weather Update",
      message: `${condition}.${temperature} No configured high-risk weather threshold was met for this check.`,
      icon: "🌤️",
      location: locationName,
    });
  }

  const existing = readStoredNotifications();

  const existingById = new Map(
    existing.map((notification) => [notification.id, notification])
  );

  const newAlerts = alerts.map((alert) => {
    const previous = existingById.get(alert.id);

    // Keep the existing notification and its read status.
    if (previous) return previous;

    return {
      ...alert,
      read: false,
      createdAt: new Date().toISOString(),
      type: "weather",
    };
  });

  const currentAlertIds = new Set(newAlerts.map((alert) => alert.id));

  // Remove outdated weather alerts for this location only.
  // Keep alerts from other locations and other notification types.
  const otherNotifications = existing.filter((notification) => {
    const id = notification?.id;

    if (typeof id !== "string") return true;

    const belongsToLocation =
      id.startsWith(`weather-${locationName}-`);

    if (!belongsToLocation) return true;

    return currentAlertIds.has(id);
  });

  // Prevent duplicate notifications.
  const merged = [...otherNotifications];
  const mergedIds = new Set(merged.map((item) => item.id));

  newAlerts.forEach((alert) => {
    if (!mergedIds.has(alert.id)) {
      merged.push(alert);
      mergedIds.add(alert.id);
    }
  });

  try {
    localStorage.setItem(
      WEATHER_NOTIFICATION_KEY,
      JSON.stringify(merged)
    );

    // Refresh the notification bell in App.jsx.
    window.dispatchEvent(new Event("agriverse-notifications-updated"));
  } catch (error) {
    console.error("Could not save weather notifications:", error);
  }
}

// --------------------------------------------------
// WEATHER PAGE
// --------------------------------------------------

export default function Weather() {
  const [location, setLocation] = useState("");
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function searchWeather(event) {
    event.preventDefault();

    const searchLocation = location.trim();

    if (!searchLocation) {
      setError("Please enter a city or location.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await getWeather(searchLocation);

      if (!result || !result.current || !result.location) {
        throw new Error("The weather response is incomplete. Please try again.");
      }

      setWeather(result);
      saveWeatherAlerts(result);
    } catch (err) {
      setError(
        err?.message ||
          "Unable to retrieve weather. Please try again."
      );
      setWeather(null);
    } finally {
      setLoading(false);
    }
  }

  const place = weather?.location || {};
  const current = weather?.current || {};
  const units = weather?.units || {};

  const forecast = Array.isArray(weather?.daily_forecast)
    ? weather.daily_forecast
    : [];

  return (
    <div className="weather-page">
      <div className="weather-header">
        <div>
          <h1>Weather Forecast</h1>
          <p>
            Check current weather conditions and forecasts to help
            plan agricultural activities.
          </p>
        </div>
      </div>

      {/* Location search */}
      <form className="weather-search" onSubmit={searchWeather}>
        <input
          type="text"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Enter city or location (e.g. Sangli)"
          aria-label="City or location"
        />

        <button type="submit" disabled={loading}>
          {loading ? "Searching..." : "Search Weather"}
        </button>
      </form>

      {error && (
        <div className="weather-error" role="alert">
          {error}
        </div>
      )}

      {!weather && !loading && !error && (
        <div className="weather-empty">
          <span className="weather-empty-icon">🌤️</span>
          <h2>Check your local weather</h2>
          <p>
            Enter a city name above to view current conditions,
            forecast details, and weather alerts.
          </p>
        </div>
      )}

      {loading && (
        <div className="weather-loading" role="status">
          <span>Loading weather data...</span>
        </div>
      )}

      {weather && !loading && (
        <>
          {/* Current weather */}
          <section className="weather-current-card">
            <div className="weather-location">
              <div>
                <h2>
                  {place.name || "Selected location"}
                  {place.admin1 ? `, ${place.admin1}` : ""}
                </h2>

                <p>
                  {place.country || ""}
                  {place.timezone ? ` (${place.timezone})` : ""}
                </p>

                {current.time && (
                  <p className="weather-updated">
                    Observation time:{" "}
                    {current.time.replace("T", " ")}
                  </p>
                )}
              </div>

              <div className="weather-condition-icon" aria-hidden="true">
                {weatherIcon(Number(current.weather_code))}
              </div>
            </div>

            <div className="weather-main-condition">
              <div className="weather-temperature">
                {showValue(
                  current.temperature,
                  units.temperature || "°C"
                )}
              </div>

              <div className="weather-condition">
                {current.condition || "Conditions unavailable"}
              </div>
            </div>

            <div className="weather-metrics">
              <div>
                <span>Feels like</span>
                <strong>
                  {showValue(
                    current.feels_like,
                    units.temperature || "°C"
                  )}
                </strong>
              </div>

              <div>
                <span>Humidity</span>
                <strong>{showValue(current.humidity, "%")}</strong>
              </div>

              <div>
                <span>Wind speed</span>
                <strong>
                  {showValue(
                    current.wind_speed,
                    ` ${units.wind_speed || "km/h"}`
                  )}
                </strong>
              </div>

              <div>
                <span>Precipitation</span>
                <strong>
                  {showValue(
                    current.precipitation,
                    ` ${units.precipitation || "mm"}`
                  )}
                </strong>
              </div>

              <div>
                <span>Rain</span>
                <strong>
                  {showValue(
                    current.rain,
                    ` ${units.rain || "mm"}`
                  )}
                </strong>
              </div>
            </div>
          </section>

          {/* Forecast */}
          <section className="weather-forecast-section">
            <div className="weather-section-heading">
              <h2>Daily Forecast</h2>
              <p>Upcoming weather conditions for this location.</p>
            </div>

            {forecast.length === 0 ? (
              <div className="weather-empty">
                <p>No daily forecast data is available.</p>
              </div>
            ) : (
              <div className="weather-forecast-grid">
                {forecast.map((day, index) => (
                  <article
                    className="weather-forecast-card"
                    key={day.date || index}
                  >
                    <h3>{formatDate(day.date)}</h3>

                    <div
                      className="weather-forecast-icon"
                      aria-label={day.condition || "Weather"}
                    >
                      {weatherIcon(Number(day.weather_code))}
                    </div>

                    <p className="weather-forecast-condition">
                      {day.condition || "Conditions unavailable"}
                    </p>

                    <div className="weather-forecast-temperatures">
                      <strong>
                        {showValue(
                          day.temperature_max,
                          units.temperature || "°C"
                        )}
                      </strong>

                      <span>
                        {showValue(
                          day.temperature_min,
                          units.temperature || "°C"
                        )}
                      </span>
                    </div>

                    <div className="weather-forecast-rain">
                      <span>Precipitation chance</span>
                      <strong>
                        {showValue(
                          day.precipitation_probability,
                          "%"
                        )}
                      </strong>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Information about alerts */}
          <section className="weather-alert-info">
            <h3>Weather Notifications</h3>
            <p>
              Weather notifications are created when the returned data
              meets configured thresholds for thunderstorms, heavy rain,
              precipitation probability of 70% or higher, wind speed of
              at least 50 km/h, or temperature of at least 40°C. If none
              of these thresholds is met, a normal Weather Update notification
              is saved instead.
            </p>
            <p>
              These are informational alerts, not official weather
              warnings. Search for a location again to refresh its
              weather data and notifications.
            </p>
          </section>

          {weather.source && (
            <p className="weather-source">
              Weather data source: {weather.source}
            </p>
          )}
        </>
      )}
    </div>
  );
}
