"""Pydantic schemas for the user module."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, model_validator

from src.shared.types import ActivityLevel, GoalType


# ---------------------------------------------------------------------------
# UserProfile schemas
# ---------------------------------------------------------------------------

class UserProfileUpdate(BaseModel):
    """Fields a user may update on their profile."""

    display_name: Optional[str] = Field(None, max_length=100)
    avatar_url: Optional[str] = Field(None, max_length=500)
    timezone: Optional[str] = Field(None, max_length=50)
    preferred_currency: Optional[str] = Field(None, max_length=3)
    region: Optional[str] = Field(None, max_length=10)
    preferences: Optional[dict[str, Any]] = None
    coaching_mode: Optional[str] = Field(None, pattern=r"^(coached|collaborative|manual)$")


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


# ---------------------------------------------------------------------------
# UserMetrics schemas
# ---------------------------------------------------------------------------

class UserMetricCreate(BaseModel):
    """Payload for logging a new physiological metrics snapshot."""

    height_cm: Optional[float] = Field(None, gt=0)
    weight_kg: Optional[float] = Field(None, gt=0)
    body_fat_pct: Optional[float] = Field(None, ge=0, le=100)
    activity_level: Optional[ActivityLevel] = None
    additional_metrics: Optional[dict[str, Any]] = None


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


# ---------------------------------------------------------------------------
# BodyweightLog schemas
# ---------------------------------------------------------------------------

class BodyweightLogCreate(BaseModel):
    """Payload for logging a bodyweight entry."""

    weight_kg: float = Field(..., gt=0)
    recorded_date: date


class BodyweightLogResponse(BaseModel):
    """Serialised bodyweight log entry."""

    id: uuid.UUID
    user_id: uuid.UUID
    weight_kg: float
    recorded_date: date
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# UserGoals schemas
# ---------------------------------------------------------------------------

class UserGoalSet(BaseModel):
    """Payload for setting / updating user goals."""

    goal_type: GoalType
    target_weight_kg: Optional[float] = Field(None, gt=0)
    target_body_fat_pct: Optional[float] = Field(None, ge=0, le=100)
    goal_rate_per_week: Optional[float] = None
    additional_goals: Optional[dict[str, Any]] = None


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


# ---------------------------------------------------------------------------
# Recalculate schemas
# ---------------------------------------------------------------------------

class RecalculateRequest(BaseModel):
    """Payload for the recalculate endpoint.
    At least one of metrics or goals must be provided."""

    metrics: Optional[UserMetricCreate] = None
    goals: Optional[UserGoalSet] = None

    @model_validator(mode='after')
    def at_least_one(self) -> 'RecalculateRequest':
        if self.metrics is None and self.goals is None:
            raise ValueError('At least one of metrics or goals must be provided')
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
