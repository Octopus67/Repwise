"""Pydantic schemas for the onboarding module."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

from src.modules.adaptive.schemas import SnapshotResponse
from src.modules.user.schemas import UserGoalResponse, UserProfileResponse
from src.shared.types import ActivityLevel, GoalType


class OnboardingCompleteRequest(BaseModel):
    """All data needed to complete onboarding in one call."""

    goal_type: GoalType
    height_cm: float = Field(ge=100, le=250)
    weight_kg: float = Field(ge=30, le=300)
    body_fat_pct: Optional[float] = Field(default=None, ge=3, le=60)
    age_years: int = Field(ge=13, le=120)
    sex: Literal["male", "female"]
    activity_level: ActivityLevel
    goal_rate_per_week: float = Field(ge=-2.0, le=2.0)
    display_name: Optional[str] = Field(default=None, max_length=100)

    # ── Food DNA fields (v2 onboarding) ──────────────────────────────────
    dietary_restrictions: Optional[list[str]] = Field(default=None, description="e.g. ['vegetarian', 'dairy_free']")
    allergies: Optional[list[str]] = Field(default=None, description="e.g. ['nuts', 'shellfish']")
    cuisine_preferences: Optional[list[str]] = Field(default=None, description="e.g. ['indian', 'mediterranean']")
    meal_frequency: Optional[int] = Field(default=None, ge=2, le=6)
    diet_style: Optional[str] = Field(default=None, description="balanced, high_protein, low_carb, keto")
    protein_per_kg: Optional[float] = Field(default=None, ge=1.0, le=3.0)
    exercise_types: Optional[list[str]] = Field(default=None, description="e.g. ['strength', 'cardio']")
    exercise_sessions_per_week: Optional[int] = Field(default=None, ge=0, le=14)


class OnboardingCompleteResponse(BaseModel):
    """Response after successful onboarding."""

    profile: UserProfileResponse
    goals: UserGoalResponse
    snapshot: SnapshotResponse
