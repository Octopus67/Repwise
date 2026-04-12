"""Pydantic schemas for the user module."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from src.shared.sanitize import strip_html  # Audit fix 2.4 — HTML sanitization
from src.shared.validators import validate_json_size
from src.shared.types import ActivityLevel, GoalType


def _ensure_tz_aware(v: datetime | None) -> datetime | None:
    """Assume UTC if datetime is naive."""
    if v is not None and v.tzinfo is None:
        return v.replace(tzinfo=timezone.utc)
    return v


# ---------------------------------------------------------------------------
# UserProfile schemas
# ---------------------------------------------------------------------------


class UserProfileUpdate(BaseModel):
    """Fields a user may update on their profile."""

    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    avatar_url: Optional[str] = Field(None, max_length=500)
    timezone: Optional[str] = Field(None, max_length=50)
    preferred_currency: Optional[str] = Field(None, max_length=3)
    region: Optional[str] = Field(None, max_length=10)
    preferences: Optional[dict[str, Any]] = None
    coaching_mode: Optional[str] = Field(None, pattern=r"^(coached|collaborative|manual)$")

    # Audit fix 2.4 — HTML sanitization
    @field_validator("display_name", mode="before")
    @classmethod
    def sanitize_text(cls, v: str) -> str:
        return strip_html(v) if isinstance(v, str) else v

    @field_validator("preferences")
    @classmethod
    def validate_preferences_size(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        return validate_json_size(v)


class UserProfileResponse(BaseModel):
    """Serialised user profile returned by the API."""

    id: uuid.UUID
    user_id: uuid.UUID
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    timezone: Optional[str] = None
    preferred_currency: Optional[str] = None
    region: Optional[str] = None
    preferences: Optional[dict[str, Any]] = None
    coaching_mode: str = "coached"
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("created_at", "updated_at", mode="after")
    @classmethod
    def ensure_tz_aware(cls, v: datetime | None) -> datetime | None:
        return _ensure_tz_aware(v)


# ---------------------------------------------------------------------------
# UserMetrics schemas
# ---------------------------------------------------------------------------


class UserMetricCreate(BaseModel):
    """Payload for logging a new physiological metrics snapshot."""

    height_cm: Optional[float] = Field(None, gt=0, le=300)
    weight_kg: Optional[float] = Field(None, gt=0, le=500)
    body_fat_pct: Optional[float] = Field(None, ge=0, le=100)
    activity_level: Optional[ActivityLevel] = None
    additional_metrics: Optional[dict[str, Any]] = None

    @model_validator(mode="after")
    def check_metric_units(self) -> "UserMetricCreate":
        """Reject values that look like imperial units sent without conversion."""
        if self.height_cm is not None and self.height_cm < 50:
            raise ValueError(
                f"height_cm={self.height_cm} looks like feet/inches — send metric (cm)"
            )
        return self

    @field_validator("additional_metrics")
    @classmethod
    def validate_additional_metrics_size(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        return validate_json_size(v)


class UserMetricResponse(BaseModel):
    """Serialised metrics entry."""

    id: uuid.UUID
    user_id: uuid.UUID
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    body_fat_pct: Optional[float] = None
    activity_level: Optional[str] = None
    additional_metrics: Optional[dict[str, Any]] = None
    recorded_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("recorded_at", "created_at", "updated_at", mode="after")
    @classmethod
    def ensure_tz_aware(cls, v: datetime | None) -> datetime | None:
        return _ensure_tz_aware(v)


# ---------------------------------------------------------------------------
# BodyweightLog schemas
# ---------------------------------------------------------------------------


class BodyweightLogCreate(BaseModel):
    """Payload for logging a bodyweight entry."""

    weight_kg: float = Field(..., gt=0, le=500)
    recorded_date: date

    @field_validator("recorded_date")
    @classmethod
    def no_far_future_dates(cls, v: date) -> date:
        from datetime import timedelta

        if v > date.today() + timedelta(days=1):
            raise ValueError("recorded_date cannot be more than 1 day in the future")
        return v


class BodyweightLogResponse(BaseModel):
    """Serialised bodyweight log entry."""

    id: uuid.UUID
    user_id: uuid.UUID
    weight_kg: float
    recorded_date: date
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("created_at", "updated_at", mode="after")
    @classmethod
    def ensure_tz_aware(cls, v: datetime | None) -> datetime | None:
        return _ensure_tz_aware(v)


# ---------------------------------------------------------------------------
# UserGoals schemas
# ---------------------------------------------------------------------------


class UserGoalSet(BaseModel):
    """Payload for setting / updating user goals."""

    goal_type: GoalType
    target_weight_kg: Optional[float] = Field(None, gt=0, le=500)
    target_body_fat_pct: Optional[float] = Field(None, ge=0, le=100)
    goal_rate_per_week: Optional[float] = Field(None, ge=-2.0, le=2.0)
    additional_goals: Optional[dict[str, Any]] = None

    @field_validator("additional_goals")
    @classmethod
    def validate_additional_goals_size(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        return validate_json_size(v)


class UserGoalResponse(BaseModel):
    """Serialised user goals."""

    id: uuid.UUID
    user_id: uuid.UUID
    goal_type: str
    target_weight_kg: Optional[float] = None
    target_body_fat_pct: Optional[float] = None
    goal_rate_per_week: Optional[float] = None
    additional_goals: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("created_at", "updated_at", mode="after")
    @classmethod
    def ensure_tz_aware(cls, v: datetime | None) -> datetime | None:
        return _ensure_tz_aware(v)


# ---------------------------------------------------------------------------
# Recalculate schemas
# ---------------------------------------------------------------------------


class RecalculateRequest(BaseModel):
    """Payload for the recalculate endpoint.
    At least one of metrics or goals must be provided."""

    metrics: Optional[UserMetricCreate] = None
    goals: Optional[UserGoalSet] = None

    @model_validator(mode="after")
    def at_least_one(self) -> "RecalculateRequest":
        if self.metrics is None and self.goals is None:
            raise ValueError("At least one of metrics or goals must be provided")
        return self


class AdaptiveTargetResponse(BaseModel):
    """Computed adaptive targets returned after recalculation."""

    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float


class RecalculateResponse(BaseModel):
    """Response from the recalculate endpoint."""

    metrics: Optional[UserMetricResponse] = None
    goals: Optional[UserGoalResponse] = None
    targets: AdaptiveTargetResponse
