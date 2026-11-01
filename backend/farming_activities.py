
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import models
from auth import get_current_user
from database import get_db


router = APIRouter(
    prefix="/farming-activities",
    tags=["Farming Activity Planner"],
)


ACTIVITY_TYPES = {
    "Sowing",
    "Irrigation",
    "Fertilizer",
    "Pest Control",
    "Weeding",
    "Harvesting",
    "Other",
}


class ActivityCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=150)
    activity_type: str = Field(..., min_length=1, max_length=50)
    scheduled_date: date
    description: str = Field(default="", max_length=2000)
    notes: str = Field(default="", max_length=2000)


class ActivityUpdate(ActivityCreate):
    completed: bool = False


class ActivityStatusUpdate(BaseModel):
    completed: bool


def validate_activity_type(activity_type: str):
    if activity_type not in ACTIVITY_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Invalid activity type. Choose one of: "
                + ", ".join(sorted(ACTIVITY_TYPES))
            ),
        )


def activity_to_dict(activity):
    return {
        "id": activity.id,
        "title": activity.title,
        "activity_type": activity.activity_type,
        "scheduled_date": activity.scheduled_date.isoformat(),
        "description": activity.description or "",
        "notes": activity.notes or "",
        "completed": activity.completed,
        "created_at": (
            activity.created_at.isoformat()
            if activity.created_at
            else None
        ),
    }


def get_owned_activity(activity_id, user_id, db):
    activity = (
        db.query(models.FarmingActivity)
        .filter(
            models.FarmingActivity.id == activity_id,
            models.FarmingActivity.owner_id == user_id,
        )
        .first()
    )

    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farming activity not found.",
        )

    return activity


@router.get("")
def get_activities(
    activity_status: str = "all",
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.FarmingActivity).filter(
        models.FarmingActivity.owner_id == current_user.id
    )

    if activity_status == "pending":
        query = query.filter(
            models.FarmingActivity.completed.is_(False)
        )
    elif activity_status == "completed":
        query = query.filter(
            models.FarmingActivity.completed.is_(True)
        )
    elif activity_status != "all":
        raise HTTPException(
            status_code=422,
            detail="Status must be all, pending, or completed.",
        )

    activities = query.order_by(
        models.FarmingActivity.scheduled_date.asc(),
        models.FarmingActivity.id.desc(),
    ).all()

    return [activity_to_dict(item) for item in activities]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_activity(
    activity_data: ActivityCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    validate_activity_type(activity_data.activity_type)

    activity = models.FarmingActivity(
        title=activity_data.title.strip(),
        activity_type=activity_data.activity_type,
        scheduled_date=activity_data.scheduled_date,
        description=activity_data.description.strip(),
        notes=activity_data.notes.strip(),
        owner_id=current_user.id,
    )

    db.add(activity)
    db.commit()
    db.refresh(activity)

    return activity_to_dict(activity)


@router.put("/{activity_id}")
def update_activity(
    activity_id: int,
    activity_data: ActivityUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    validate_activity_type(activity_data.activity_type)

    activity = get_owned_activity(
        activity_id, current_user.id, db
    )

    activity.title = activity_data.title.strip()
    activity.activity_type = activity_data.activity_type
    activity.scheduled_date = activity_data.scheduled_date
    activity.description = activity_data.description.strip()
    activity.notes = activity_data.notes.strip()
    activity.completed = activity_data.completed

    db.commit()
    db.refresh(activity)

    return activity_to_dict(activity)


@router.patch("/{activity_id}/status")
def update_activity_status(
    activity_id: int,
    status_data: ActivityStatusUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    activity = get_owned_activity(
        activity_id, current_user.id, db
    )

    activity.completed = status_data.completed

    db.commit()
    db.refresh(activity)

    return activity_to_dict(activity)


@router.delete("/{activity_id}")
def delete_activity(
    activity_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    activity = get_owned_activity(
        activity_id, current_user.id, db
    )

    db.delete(activity)
    db.commit()

    return {"message": "Farming activity deleted successfully."}
