
import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

import models
from auth import SECRET_KEY, get_current_user
from database import get_db
from weather import router as weather_router
from crop_recommendation import router as crop_recommendation_router

from database import get_db, engine
from farming_activities import router as farming_activities_router\nfrom farmerfinance import router as farm_finance_router


# --------------------------------------------------
# APP CONFIGURATION
# --------------------------------------------------

app = FastAPI(title="AgriVerse API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(weather_router)
app.include_router(crop_recommendation_router)
app.include_router(farming_activities_router)\napp.include_router(farm_finance_router)



@app.on_event("startup")
def create_database_tables():
    models.Base.metadata.create_all(bind=engine)
    

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


# --------------------------------------------------
# REQUEST SCHEMAS
# --------------------------------------------------

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)


class FarmerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    phone: str = Field(..., max_length=30)
    location: str = Field(..., min_length=1, max_length=200)
    farm_size: str = Field(..., max_length=50)
    crop: str = Field(..., min_length=1, max_length=150)


class FarmerUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    phone: str = Field(..., max_length=30)
    location: str = Field(..., min_length=1, max_length=200)
    farm_size: str = Field(..., max_length=50)
    crop: str = Field(..., min_length=1, max_length=150)


# --------------------------------------------------
# HELPER FUNCTIONS
# --------------------------------------------------

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except (ValueError, TypeError):
        return False


def create_access_token(email: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": email,
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def user_to_dict(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
    }


def farmer_to_dict(farmer):
    return {
        "id": farmer.id,
        "name": farmer.name,
        "phone": farmer.phone,
        "location": farmer.location,
        "farm_size": farmer.farm_size,
        "crop": farmer.crop,
        "owner_id": farmer.owner_id,
    }


def parse_farm_size(value):
    if value is None:
        return None

    try:
        number = float(str(value).strip())

        if math.isfinite(number) and number >= 0:
            return number

    except (ValueError, TypeError):
        pass

    return None


# --------------------------------------------------
# ROOT AND HEALTH CHECK
# --------------------------------------------------

@app.get("/")
def home():
    return {"message": "Welcome to AgriVerse API"}


@app.get("/health")
def health():
    return {"status": "ok"}


# --------------------------------------------------
# REGISTRATION
# --------------------------------------------------

@app.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    user_data: RegisterRequest,
    db: Session = Depends(get_db),
):
    email = str(user_data.email).strip().lower()

    existing_user = (
        db.query(models.User)
        .filter(models.User.email == email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    new_user = models.User(
        username=user_data.username.strip(),
        email=email,
        password_hash=hash_password(user_data.password),
    )

    db.add(new_user)

    try:
        db.commit()
        db.refresh(new_user)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create the account.",
        )

    return {
        "message": "Registration successful",
        "user": user_to_dict(new_user),
    }


# --------------------------------------------------
# LOGIN
# Supports Swagger OAuth2 form and React form requests.
# Swagger uses "username" for the registered email.
# --------------------------------------------------

@app.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    email = form_data.username.strip().lower()
    password = form_data.password

    user = (
        db.query(models.User)
        .filter(models.User.email == email)
        .first()
    )

    if not user or not verify_password(
        password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(user.email)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_to_dict(user),
    }


# --------------------------------------------------
# USER PROFILE
# --------------------------------------------------

@app.get("/users/me")
def get_my_profile(
    current_user: models.User = Depends(get_current_user),
):
    return user_to_dict(current_user)


# --------------------------------------------------
# FARMER CRUD
# --------------------------------------------------

@app.get("/farmers")
def get_farmers(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farmers = (
        db.query(models.Farmer)
        .filter(models.Farmer.owner_id == current_user.id)
        .order_by(models.Farmer.id.desc())
        .all()
    )

    return [farmer_to_dict(farmer) for farmer in farmers]


@app.post("/farmers", status_code=status.HTTP_201_CREATED)
def create_farmer(
    farmer_data: FarmerCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farmer = models.Farmer(
        name=farmer_data.name.strip(),
        phone=farmer_data.phone.strip(),
        location=farmer_data.location.strip(),
        farm_size=farmer_data.farm_size.strip(),
        crop=farmer_data.crop.strip(),
        owner_id=current_user.id,
    )

    db.add(farmer)
    db.commit()
    db.refresh(farmer)

    return farmer_to_dict(farmer)


@app.get("/farmers/{farmer_id}")
def get_farmer(
    farmer_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farmer = (
        db.query(models.Farmer)
        .filter(
            models.Farmer.id == farmer_id,
            models.Farmer.owner_id == current_user.id,
        )
        .first()
    )

    if not farmer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farmer not found.",
        )

    return farmer_to_dict(farmer)


@app.put("/farmers/{farmer_id}")
def update_farmer(
    farmer_id: int,
    farmer_data: FarmerUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farmer = (
        db.query(models.Farmer)
        .filter(
            models.Farmer.id == farmer_id,
            models.Farmer.owner_id == current_user.id,
        )
        .first()
    )

    if not farmer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farmer not found.",
        )

    farmer.name = farmer_data.name.strip()
    farmer.phone = farmer_data.phone.strip()
    farmer.location = farmer_data.location.strip()
    farmer.farm_size = farmer_data.farm_size.strip()
    farmer.crop = farmer_data.crop.strip()

    db.commit()
    db.refresh(farmer)

    return farmer_to_dict(farmer)


@app.delete("/farmers/{farmer_id}")
def delete_farmer(
    farmer_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farmer = (
        db.query(models.Farmer)
        .filter(
            models.Farmer.id == farmer_id,
            models.Farmer.owner_id == current_user.id,
        )
        .first()
    )

    if not farmer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farmer not found.",
        )

    db.delete(farmer)
    db.commit()

    return {"message": "Farmer deleted successfully"}


# --------------------------------------------------
# DASHBOARD ANALYTICS
# --------------------------------------------------

@app.get("/analytics/dashboard")
def get_dashboard_analytics(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farmers = (
        db.query(models.Farmer)
        .filter(models.Farmer.owner_id == current_user.id)
        .all()
    )

    crop_counts = defaultdict(int)
    location_counts = defaultdict(int)
    numeric_sizes = []

    for farmer in farmers:
        crop_name = (farmer.crop or "").strip()
        location_name = (farmer.location or "").strip()

        if crop_name:
            crop_counts[crop_name] += 1

        if location_name:
            location_counts[location_name] += 1

        size = parse_farm_size(farmer.farm_size)

        if size is not None:
            numeric_sizes.append(size)

    total_farm_size = sum(numeric_sizes)

    average_farm_size = (
        total_farm_size / len(numeric_sizes)
        if numeric_sizes
        else 0
    )

    return {
        "total_farmers": len(farmers),
        "total_crop_types": len(crop_counts),
        "total_locations": len(location_counts),
        "total_farm_size": round(total_farm_size, 2),
        "average_farm_size": round(average_farm_size, 2),
        "numeric_farm_size_records": len(numeric_sizes),
        "crop_distribution": [
            {"name": name, "count": count}
            for name, count in sorted(
                crop_counts.items(),
                key=lambda item: item[1],
                reverse=True,
            )
        ],
        "location_distribution": [
            {"name": name, "count": count}
            for name, count in sorted(
                location_counts.items(),
                key=lambda item: item[1],
                reverse=True,
            )
        ],
    }
