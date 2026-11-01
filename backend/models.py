
from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    Date,
    Text,
    Boolean,
    DateTime,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


# =========================================================
# USER TABLE
# =========================================================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)

    farmers = relationship(
        "Farmer",
        back_populates="owner",
        cascade="all, delete-orphan",
    )

    farming_activities = relationship(
        "FarmingActivity",
        back_populates="owner",
        cascade="all, delete-orphan",
    )


# =========================================================
# FARMER TABLE
# =========================================================

class Farmer(Base):
    __tablename__ = "farmers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    location = Column(String, nullable=False)
    farm_size = Column(String, nullable=False)
    crop = Column(String, nullable=False)

    owner_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    owner = relationship("User", back_populates="farmers")


# =========================================================
# FARMING ACTIVITY TABLE
# =========================================================

class FarmingActivity(Base):
    __tablename__ = "farming_activities"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String(150), nullable=False)
    activity_type = Column(String(50), nullable=False)
    scheduled_date = Column(Date, nullable=False, index=True)
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    completed = Column(Boolean, nullable=False, default=False)

    owner_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    owner = relationship(
        "User",
        back_populates="farming_activities",
    )
