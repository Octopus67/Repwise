"""Adaptive module Pydantic request/response schemas."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from src.shared.types import ActivityLevel, GoalType


class BodyweightEntry(BaseModel):
    """A single bodyweight data point."""

    date: date
    weight_kg: float = Field(gt=0)


class SnapshotRequest(BaseModel):
    """Payload for generating a new adaptive snapshot."""

    weight_kg: float = Field(gt=0, le=500, description="Current weight in kg")
    height_cm: float = Field(gt=0, le=300, description="Height in cm")
    age_years: int = Field(ge=1, le=120, description="Age in years")
    sex: Literal["male", "female"]
    activity_level: ActivityLevel
    goal_type: GoalType
    goal_rate_per_week: float = Field(
        ge=-2.0, le=2.0, description="Target weekly weight change in kg"
    )
    bodyweight_history: list[BodyweightEntry] = Field(
        min_length=1, description="Recent bodyweight entries (min 1)"
    )
    training_load_score: float = Field(
        ge=0, le=100, description="Training load score 0-100"
    )


class SnapshotResponse(BaseModel):
    """Adaptive snapshot returned by the API."""

    id: uuid.UUID
    user_id: uuid.UUID
    target_calories: float
    target_protein_g: float
    target_carbs_g: float
    target_fat_g: float
    ema_current: float
    adjustment_factor: float
    input_parameters: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class RecalculationStatusResponse(BaseModel):
    """Response indicating whether a recalculation is recommended."""

    needs_recalculation: bool
    reasons: list[str] = Field(default_factory=list)
    last_snapshot_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Feature 3: Adaptive Coaching Tiers — Schemas
# ---------------------------------------------------------------------------


class MacroTargets(BaseModel):
    """Macro target values."""

    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float


class MacroModifications(BaseModel):
    """User-modified macro targets for collaborative mode."""

    calories: float = Field(ge=1200)
    protein_g: float = Field(ge=0)
    carbs_g: float = Field(ge=0)
    fat_g: float = Field(ge=0)


class WeeklyCheckinResponse(BaseModel):
    """Response from the weekly check-in endpoint."""

    has_sufficient_data: bool
    days_remaining: Optional[int] = None
    new_targets: Optional[MacroTargets] = None
    previous_targets: Optional[MacroTargets] = None
    weight_trend: Optional[float] = None
    weekly_weight_change: Optional[float] = None
    explanation: str
    suggestion_id: Optional[uuid.UUID] = None
    coaching_mode: str


# ---------------------------------------------------------------------------
# Feature: Nutrition-Training Sync Engine — Schemas
# ---------------------------------------------------------------------------


class DailyTargetResponse(BaseModel):
    """Full response for daily adjusted targets."""

    date: date
    day_classification: str
    classification_reason: str
    baseline: MacroTargets
    adjusted: MacroTargets
    override: Optional[MacroTargets] = None
    effective: MacroTargets
    muscle_group_demand: float
    volume_multiplier: float
    training_phase: str
    calorie_delta: float
    explanation: str


class OverrideCreate(BaseModel):
    """Payload for setting a daily target override."""

    date: date
    calories: float = Field(ge=800)
    protein_g: float = Field(ge=0)
    carbs_g: float = Field(ge=0)
    fat_g: float = Field(ge=0)


class OverrideResponse(BaseModel):
    """Serialised daily target override."""

    id: uuid.UUID
    user_id: uuid.UUID
    target_date: date
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    created_at: datetime

    model_config = {"from_attributes": True}


class CoachingSuggestionResponse(BaseModel):
    """Serialised coaching suggestion."""

    id: uuid.UUID
    user_id: uuid.UUID
    snapshot_id: uuid.UUID
    status: str
    proposed_calories: float
    proposed_protein_g: float
    proposed_carbs_g: float
    proposed_fat_g: float
    modified_calories: Optional[float] = None
    modified_protein_g: Optional[float] = None
    modified_carbs_g: Optional[float] = None
    modified_fat_g: Optional[float] = None
    explanation: str
    resolved_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
