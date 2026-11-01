
from fastapi import APIRouter
from pydantic import BaseModel, Field


router = APIRouter(
    prefix="/crop-recommendation",
    tags=["Crop Recommendation"],
)


# --------------------------------------------------
# REQUEST MODEL AND INPUT VALIDATION
# --------------------------------------------------

class CropInput(BaseModel):
    nitrogen: float = Field(ge=0, le=200)
    phosphorus: float = Field(ge=0, le=200)
    potassium: float = Field(ge=0, le=250)

    temperature: float = Field(ge=0, le=60)
    humidity: float = Field(ge=0, le=100)
    ph: float = Field(ge=0, le=14)
    rainfall: float = Field(ge=0, le=5000)

    soil_type: str = Field(min_length=1, max_length=50)
    season: str = Field(min_length=1, max_length=30)


# --------------------------------------------------
# CROP KNOWLEDGE BASE
# These values are broad prototype ranges.
# They are not locally calibrated agronomic thresholds.
# --------------------------------------------------

CROPS = [
    {
        "name": "Rice",
        "description": (
            "A cereal crop commonly grown in warm areas "
            "where adequate water is available."
        ),
        "temp": (20, 35),
        "humidity": (60, 100),
        "ph": (5.0, 7.0),
        "rainfall": (100, 300),
        "soil": ["clay", "loamy", "alluvial"],
        "seasons": ["kharif"],
        "growing_season": "Kharif (monsoon)",
        "guidance": (
            "Check water availability, drainage, suitable variety, "
            "and local planting dates before sowing."
        ),
        "explanation": (
            "The supplied conditions are compared with broad "
            "warm, humid rice-growing ranges."
        ),
    },
    {
        "name": "Wheat",
        "description": (
            "A cereal crop generally grown during the cooler "
            "part of the growing cycle."
        ),
        "temp": (10, 25),
        "humidity": (30, 70),
        "ph": (5.5, 7.5),
        "rainfall": (30, 100),
        "soil": ["loamy", "alluvial", "clay"],
        "seasons": ["rabi"],
        "growing_season": "Rabi (winter)",
        "guidance": (
            "Check local sowing dates, soil fertility, irrigation "
            "availability, and recommended variety."
        ),
        "explanation": (
            "The supplied conditions are compared with broad "
            "cool-season cereal-growing ranges."
        ),
    },
    {
        "name": "Maize",
        "description": (
            "A cereal crop used for food, feed, and other products."
        ),
        "temp": (18, 32),
        "humidity": (40, 85),
        "ph": (5.5, 7.5),
        "rainfall": (50, 150),
        "soil": ["loamy", "alluvial", "sandy"],
        "seasons": ["kharif", "rabi", "zaid"],
        "growing_season": "Kharif, Rabi, or Zaid, depending on location",
        "guidance": (
            "Ensure suitable drainage and water supply. Select "
            "the variety and sowing window for your local climate."
        ),
        "explanation": (
            "The supplied conditions are compared with broad "
            "maize-growing ranges."
        ),
    },
    {
        "name": "Chickpea",
        "description": (
            "A pulse crop that can contribute protein to diets "
            "and nitrogen to cropping systems."
        ),
        "temp": (15, 30),
        "humidity": (20, 60),
        "ph": (6.0, 8.0),
        "rainfall": (20, 80),
        "soil": ["loamy", "black", "alluvial"],
        "seasons": ["rabi"],
        "growing_season": "Rabi (winter)",
        "guidance": (
            "Check soil drainage, local sowing time, and "
            "regionally recommended varieties."
        ),
        "explanation": (
            "The supplied conditions are compared with broad "
            "pulse-growing ranges."
        ),
    },
    {
        "name": "Cotton",
        "description": (
            "A fibre crop commonly cultivated in warm growing "
            "regions."
        ),
        "temp": (21, 35),
        "humidity": (30, 80),
        "ph": (5.5, 8.0),
        "rainfall": (50, 150),
        "soil": ["black", "loamy", "alluvial"],
        "seasons": ["kharif"],
        "growing_season": "Kharif (monsoon)",
        "guidance": (
            "Confirm local sowing dates, drainage, pest management, "
            "and the variety recommended for your region."
        ),
        "explanation": (
            "The supplied conditions are compared with broad "
            "cotton-growing ranges."
        ),
    },
    {
        "name": "Sugarcane",
        "description": (
            "A long-duration crop grown for sugar and related products."
        ),
        "temp": (20, 35),
        "humidity": (40, 85),
        "ph": (5.5, 8.0),
        "rainfall": (75, 250),
        "soil": ["loamy", "alluvial", "black"],
        "seasons": ["kharif", "rabi"],
        "growing_season": "Planting season varies by region",
        "guidance": (
            "Plan for a long growing period and reliable water. "
            "Follow local recommendations for planting and nutrients."
        ),
        "explanation": (
            "The supplied conditions are compared with broad "
            "sugarcane-growing ranges."
        ),
    },
    {
        "name": "Groundnut",
        "description": (
            "An oilseed and food crop that generally benefits "
            "from loose, well-drained soil."
        ),
        "temp": (20, 35),
        "humidity": (30, 75),
        "ph": (5.5, 7.0),
        "rainfall": (50, 125),
        "soil": ["sandy", "loamy", "red"],
        "seasons": ["kharif", "zaid"],
        "growing_season": "Kharif or Zaid, depending on location",
        "guidance": (
            "Check drainage, local rainfall patterns, seed quality, "
            "and regional sowing recommendations."
        ),
        "explanation": (
            "The supplied conditions are compared with broad "
            "groundnut-growing ranges."
        ),
    },
    {
        "name": "Pigeon Pea",
        "description": (
            "A pulse crop commonly grown in warm regions, "
            "including monsoon-season farming systems."
        ),
        "temp": (20, 35),
        "humidity": (30, 80),
        "ph": (5.0, 8.0),
        "rainfall": (60, 150),
        "soil": ["black", "loamy", "red", "alluvial"],
        "seasons": ["kharif"],
        "growing_season": "Kharif (monsoon)",
        "guidance": (
            "Confirm suitable varieties, local sowing dates, "
            "drainage, and regional crop-management guidance."
        ),
        "explanation": (
            "The supplied conditions are compared with broad "
            "pigeon-pea-growing ranges."
        ),
    },
]


# --------------------------------------------------
# SUITABILITY SCORING
# --------------------------------------------------

def range_score(value: float, limits: tuple) -> float:
    """Return a prototype score between 0 and 1."""
    low, high = limits

    if low <= value <= high:
        return 1.0

    distance = low - value if value < low else value - high
    width = max(high - low, 1)

    return max(0.0, 1.0 - distance / width)


def get_suitability_label(score: int) -> str:
    """Describe the prototype score without guaranteeing crop success."""
    if score >= 80:
        return "Higher match"
    if score >= 60:
        return "Moderate match"
    return "Lower match"


# --------------------------------------------------
# CROP RECOMMENDATION ENDPOINT
# --------------------------------------------------

@router.post("/recommend")
def recommend_crops(data: CropInput):
    soil = data.soil_type.strip().lower()
    season = data.season.strip().lower()

    if not soil or not season:
        return {
            "recommendations": [],
            "message": "Please provide both soil type and season.",
        }

    valid_seasons = {"kharif", "rabi", "zaid"}

    if season not in valid_seasons:
        return {
            "recommendations": [],
            "message": (
                "Unknown season. Please use Kharif, Rabi, or Zaid."
            ),
        }

    scored_crops = []

    for crop in CROPS:
        factor_scores = {
            "temperature": range_score(
                data.temperature, crop["temp"]
            ),
            "humidity": range_score(
                data.humidity, crop["humidity"]
            ),
            "ph": range_score(
                data.ph, crop["ph"]
            ),
            "rainfall": range_score(
                data.rainfall, crop["rainfall"]
            ),
        }

        soil_score = 1.0 if soil in crop["soil"] else 0.45
        season_score = 1.0 if season in crop["seasons"] else 0.35

        overall = (
            sum(factor_scores.values()) / len(factor_scores) * 0.70
            + soil_score * 0.15
            + season_score * 0.15
        )

        suitability = round(overall * 100)

        scored_crops.append({
            "crop": crop["name"],
            "description": crop["description"],
            "growing_season": crop["growing_season"],
            "suitability_percent": suitability,
            "suitability_label": get_suitability_label(suitability),
            "explanation": crop["explanation"],
            "cultivation_guidance": crop["guidance"],
            "factor_scores": {
                key: round(value * 100)
                for key, value in factor_scores.items()
            },
        })

    scored_crops.sort(
        key=lambda item: item["suitability_percent"],
        reverse=True,
    )

    return {
        "recommendations": scored_crops[:3],
        "message": (
            "These are preliminary rule-based suggestions, not "
            "guarantees of yield or crop success. Scores are prototype "
            "comparisons, not scientifically calibrated probabilities. "
            "Confirm soil fertility, local climate, water availability, "
            "and planting dates with a local agricultural expert."
        ),
    }
