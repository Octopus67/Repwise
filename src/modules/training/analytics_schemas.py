"""Training analytics Pydantic response schemas."""

from __future__ import annotations
from typing import Optional

from datetime import date

from pydantic import BaseModel, Field


class VolumeTrendPoint(BaseModel):
    """A single data point in a volume trend time series."""

    date: date
    total_volume: float = Field(ge=0, description="Sum of (reps × weight_kg) for all sets")


class StrengthProgressionPoint(BaseModel):
    """A single data point in a strength progression time series."""

    date: date
    exercise_name: str
    best_weight_kg: float = Field(ge=0)
    best_reps: int = Field(ge=0)
    estimated_1rm: Optional[float] = None


class MuscleGroupFrequency(BaseModel):
    """Session count for a muscle group in a given ISO week."""

    muscle_group: str
    week_start: date
    session_count: int = Field(ge=0)


class PersonalRecord(BaseModel):
    """A detected personal record for an exercise at a given rep count."""

    exercise_name: str
    reps: int = Field(ge=0)
    new_weight_kg: float = Field(ge=0)
    previous_weight_kg: Optional[float] = None


class PreviousPerformance(BaseModel):
    """Previous performance data for an exercise from the most recent session."""

    exercise_name: str
    session_date: date
    last_set_weight_kg: float = Field(ge=0)
    last_set_reps: int = Field(ge=0)


# ─── e1RM and Strength Standards Schemas ──────────────────────────────────────


class E1RMHistoryPoint(BaseModel):
    """A single data point in an e1RM trend time series."""

    date: date
    exercise_name: str
    e1rm_kg: float = Field(ge=0)
    formula: str = "epley"
    low_confidence: bool = False


class StrengthClassificationResponse(BaseModel):
    """Strength classification for a single supported lift."""

    exercise_name: str
    e1rm_kg: float
    bodyweight_kg: float
    bodyweight_ratio: float
    level: str
    next_level: Optional[str]
    next_level_threshold_kg: Optional[float]


class MilestoneResponse(BaseModel):
    """A motivational milestone message."""

    exercise_name: str
    current_e1rm_kg: float
    next_level: Optional[str]
    deficit_kg: float
    message: str


class StrengthStandardsResponse(BaseModel):
    """Full strength standards response with classifications and milestones."""

    classifications: list[StrengthClassificationResponse]
    milestones: list[MilestoneResponse]
    bodyweight_kg: Optional[float]
