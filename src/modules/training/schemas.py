"""Training module Pydantic request/response schemas."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class SetEntry(BaseModel):
    """A single set within an exercise."""

    reps: int = Field(ge=0, description="Number of repetitions")
    weight_kg: float = Field(ge=0, description="Weight in kilograms")
    rpe: Optional[float] = Field(
        default=None, ge=0, le=10, description="Rate of perceived exertion (0-10)"
    )
    set_type: str = Field(
        default="normal",
        description="Set type: normal, warm-up, drop-set, amrap",
    )

    @field_validator("set_type")
    @classmethod
    def validate_set_type(cls, v: str) -> str:
        allowed = {"normal", "warm-up", "drop-set", "amrap"}
        if v not in allowed:
            raise ValueError(f"set_type must be one of {allowed}")
        return v


class ExerciseEntry(BaseModel):
    """A single exercise with its sets."""

    exercise_name: str = Field(min_length=1, description="Name of the exercise")
    sets: list[SetEntry] = Field(min_length=1, description="At least one set required")


class TrainingSessionCreate(BaseModel):
    """Payload for creating a new training session."""

    session_date: date
    exercises: list[ExerciseEntry] = Field(
        min_length=1, description="At least one exercise required"
    )
    metadata: Optional[dict[str, Any]] = Field(
        default=None, description="Extensible session metadata"
    )
    start_time: Optional[datetime] = Field(default=None, description="Workout start timestamp")
    end_time: Optional[datetime] = Field(default=None, description="Workout end timestamp")

    @field_validator("session_date")
    @classmethod
    def no_future_dates(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("session_date cannot be in the future")
        return v


class TrainingSessionUpdate(BaseModel):
    """Payload for updating an existing training session. All fields optional."""

    session_date: Optional[date] = None
    exercises: Optional[list[ExerciseEntry]] = None
    metadata: Optional[dict[str, Any]] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class WorkoutTemplateResponse(BaseModel):
    """A pre-built workout template."""

    id: str
    name: str
    description: str
    exercises: list[ExerciseEntry]


class PersonalRecordResponse(BaseModel):
    """A detected personal record for an exercise at a given rep count."""

    exercise_name: str
    reps: int
    new_weight_kg: float
    previous_weight_kg: Optional[float] = None


class NewlyUnlockedAchievement(BaseModel):
    """Achievement unlocked during this request (from achievement engine)."""

    achievement_id: str
    title: str
    description: str
    icon: str
    category: str


class TrainingSessionResponse(BaseModel):
    """Training session returned by the API."""

    id: uuid.UUID
    user_id: uuid.UUID
    session_date: date
    exercises: list[ExerciseEntry]
    metadata: Optional[dict[str, Any]] = None
    personal_records: list[PersonalRecordResponse] = Field(
        default_factory=list, description="Personal records detected in this session"
    )
    newly_unlocked: list[NewlyUnlockedAchievement] = Field(
        default_factory=list, description="Achievements unlocked by this session"
    )
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_model(
        cls,
        obj: Any,
        personal_records: Optional[list[PersonalRecordResponse]] = None,
        newly_unlocked: Optional[list[NewlyUnlockedAchievement]] = None,
    ) -> TrainingSessionResponse:
        """Build a response from a SQLAlchemy model instance.

        Handles the ``metadata_`` → ``metadata`` column alias.
        """
        return cls(
            id=obj.id,
            user_id=obj.user_id,
            session_date=obj.session_date,
            exercises=obj.exercises,
            metadata=obj.metadata_,
            personal_records=personal_records or [],
            newly_unlocked=newly_unlocked or [],
            start_time=obj.start_time,
            end_time=obj.end_time,
            created_at=obj.created_at,
            updated_at=obj.updated_at,
        )


# ─── Batch Previous Performance ──────────────────────────────────────────────


class BatchPreviousPerformanceRequest(BaseModel):
    """Request payload for batch previous performance lookup."""

    exercise_names: list[str] = Field(min_length=1, max_length=20)


class PreviousPerformanceSetData(BaseModel):
    """A single set from a previous performance result."""

    weight_kg: float
    reps: int
    rpe: Optional[float] = None


class PreviousPerformanceResult(BaseModel):
    """Previous performance data for a single exercise."""

    exercise_name: str
    session_date: date
    sets: list[PreviousPerformanceSetData]


class BatchPreviousPerformanceResponse(BaseModel):
    """Response for batch previous performance lookup."""

    results: dict[str, Optional[PreviousPerformanceResult]]


class WorkoutTemplateCreate(BaseModel):
    """Payload for creating a user workout template."""

    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    exercises: list[ExerciseEntry] = Field(min_length=1)
    metadata: Optional[dict[str, Any]] = None


class WorkoutTemplateUpdate(BaseModel):
    """Payload for updating a user workout template. All fields optional."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    exercises: Optional[list[ExerciseEntry]] = None
    metadata: Optional[dict[str, Any]] = None


class UserWorkoutTemplateResponse(BaseModel):
    """User-created workout template returned by the API."""

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    description: Optional[str] = None
    exercises: list[ExerciseEntry]
    metadata: Optional[dict[str, Any]] = None
    is_system: bool = False
    sort_order: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_model(cls, obj: Any) -> UserWorkoutTemplateResponse:
        """Build a response from a SQLAlchemy WorkoutTemplate instance."""
        return cls(
            id=obj.id,
            user_id=obj.user_id,
            name=obj.name,
            description=obj.description,
            exercises=obj.exercises,
            metadata=obj.metadata_,
            is_system=False,
            sort_order=obj.sort_order,
            created_at=obj.created_at,
            updated_at=obj.updated_at,
        )


class DayClassificationResponse(BaseModel):
    """Day classification result for a given date."""

    is_training_day: bool
    classification: str  # "training" or "rest"
    muscle_groups: list[str]  # deduplicated, sorted alphabetically
    source: str  # "session", "template", or "none"


