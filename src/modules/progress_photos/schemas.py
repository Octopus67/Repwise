"""Pydantic schemas for progress photo CRUD operations."""

from __future__ import annotations
from typing import Optional

import uuid
from datetime import date, datetime, timedelta, timezone

from pydantic import BaseModel, Field, field_validator


# Constraints
MAX_NOTES_LENGTH = 500
MIN_BODYWEIGHT_KG = 20.0
MAX_BODYWEIGHT_KG = 400.0
MAX_FUTURE_DAYS = 1  # allow today + 1 day for timezone edge cases


class AlignmentData(BaseModel):
    """Body alignment data for auto-alignment comparison.

    Coordinates are normalized 0-1. Scale is relative (1.0 = baseline).
    """

    centerX: float = Field(ge=0.0, le=1.0)
    centerY: float = Field(ge=0.0, le=1.0)
    scale: float = Field(gt=0.0, le=10.0)


class PhotoCreate(BaseModel):
    """Schema for creating progress photo metadata.

    bodyweight_kg is optional — auto-filled from latest BodyweightLog if None.
    pose_type must be one of: front_relaxed, front_double_bicep, side, back.
    """

    capture_date: date
    bodyweight_kg: Optional[float] = Field(
        default=None,
        ge=MIN_BODYWEIGHT_KG,
        le=MAX_BODYWEIGHT_KG,
    )
    pose_type: str = Field(
        default="front_relaxed",
        pattern=r"^(front_relaxed|front_double_bicep|side|back)$",
    )
    notes: Optional[str] = Field(default=None, max_length=MAX_NOTES_LENGTH)
    alignment_data: Optional[AlignmentData] = None

    @field_validator("capture_date")
    @classmethod
    def capture_date_not_far_future(cls, v: date) -> date:
        today = datetime.now(timezone.utc).date()
        max_date = today + timedelta(days=MAX_FUTURE_DAYS)
        if v > max_date:
            raise ValueError(
                f"capture_date cannot be more than {MAX_FUTURE_DAYS} day(s) in the future"
            )
        return v


class PhotoUpdate(BaseModel):
    """Schema for partial updates to progress photo metadata (PATCH)."""

    alignment_data: Optional[AlignmentData] = None
    notes: Optional[str] = Field(default=None, max_length=MAX_NOTES_LENGTH)
    bodyweight_kg: Optional[float] = Field(
        default=None,
        ge=MIN_BODYWEIGHT_KG,
        le=MAX_BODYWEIGHT_KG,
    )


class PhotoResponse(BaseModel):
    """Schema for returning progress photo metadata in API responses."""

    id: uuid.UUID
    user_id: uuid.UUID
    capture_date: date
    bodyweight_kg: Optional[float] = None
    pose_type: str
    notes: Optional[str] = None
    alignment_data: Optional[AlignmentData] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class UploadUrlRequest(BaseModel):
    """Schema for requesting a pre-signed upload URL."""

    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(
        default="image/jpeg",
        pattern=r"^image/(jpeg|png|webp)$",
    )


class UploadUrlResponse(BaseModel):
    """Schema for the pre-signed upload URL response."""

    upload_url: str
    key: str

