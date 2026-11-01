from pydantic import BaseModel, EmailStr, ConfigDict


# =========================================================
# USER SCHEMAS
# =========================================================

class UserCreate(BaseModel):

    username: str

    email: EmailStr

    password: str


class UserLogin(BaseModel):

    email: EmailStr

    password: str


class UserResponse(BaseModel):

    id: int

    username: str

    email: EmailStr

    model_config = ConfigDict(
        from_attributes=True
    )


# =========================================================
# FARMER SCHEMAS
# =========================================================

class FarmerCreate(BaseModel):

    name: str

    phone: str

    location: str

    farm_size: str

    crop: str


class FarmerResponse(BaseModel):

    id: int

    name: str

    phone: str

    location: str

    farm_size: str

    crop: str

    owner_id: int

    model_config = ConfigDict(
        from_attributes=True
    )


# =========================================================
# TOKEN SCHEMA
# =========================================================

class Token(BaseModel):

    access_token: str

    token_type: str