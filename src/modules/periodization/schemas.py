"""Periodization module Pydantic request/response schemas."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


VALID_PHASE_TYPES = {"accumulation", "intensification", "deload", "peak"}
VALID_NUTRITION_PHASES = {"bulk", "cut", "maintenance"}


class TrainingBlockCreate(BaseModel):
    """Payload for creating a new training block."""

    name: str = Field(min_length=1, max_length=100)
    phase_type: str
    start_date: date
    end_date: date
    nutrition_phase: Optional[str] = None

    @field_validator("phase_type")
    @classmethod
    def validate_phase_type(cls, v: str) -> str:
        if v not in VALID_PHASE_TYPES:
            raise ValueError(
                f"phase_type must be one of: {', '.join(sorted(VALID_PHASE_TYPES))}"
            )
        return v

    @field_validator("nutrition_phase")
    @classmethod
    def validate_nutrition_phase(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_NUTRITION_PHASES:
            raise ValueError(
                f"nutrition_phase must be one of: {', '.join(sorted(VALID_NUTRITION_PHASES))}"
            )
        return v

    @model_validator(mode="after")
    def validate_date_range(self) -> TrainingBlockCreate:
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        duration_days = (self.end_date - self.start_date).days + 1
        if duration_days > 365:
            raise ValueError("Block duration cannot exceed 365 days")
        return self


class TrainingBlockUpdate(BaseModel):
    """Payload for updating a training block. All fields optional."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    phase_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    nutrition_phase: Optional[str] = None

    @field_validator("phase_type")
    @classmethod
    def validate_phase_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_PHASE_TYPES:
            raise ValueError(
                f"phase_type must be one of: {', '.join(sorted(VALID_PHASE_TYPES))}"
            )
        return v

    @field_validator("nutrition_phase")
    @classmethod
    def validate_nutrition_phase(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_NUTRITION_PHASES:
            raise ValueError(
                f"nutrition_phase must be one of: {', '.join(sorted(VALID_NUTRITION_PHASES))}"
            )
        return v


class TrainingBlockResponse(BaseModel):
    """Training block returned by the API."""

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    phase_type: str
    start_date: date
    end_date: date
    nutrition_phase: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_model(cls, obj: Any) -> TrainingBlockResponse:
        """Build a response from a SQLAlchemy TrainingBlock instance."""
        return cls(
            id=obj.id,
            user_id=obj.user_id,
            name=obj.name,
            phase_type=obj.phase_type,
            start_date=obj.start_date,
            end_date=obj.end_date,
            nutrition_phase=obj.nutrition_phase,
            created_at=obj.created_at,
            updated_at=obj.updated_at,
        )


class TemplatePhase(BaseModel):
    """A single phase within a block template."""

    phase_type: str
    duration_weeks: int


class BlockTemplateResponse(BaseModel):
    """Block template returned by the API."""

    id: str
    name: str
    description: str
    phases: list[TemplatePhase]


class ApplyTemplateRequest(BaseModel):
    """Payload for applying a block template."""

    template_id: str
    start_date: date


class DeloadSuggestion(BaseModel):
    """Deload suggestion returned by the API."""

    message: str
    suggested_start_date: date
    consecutive_weeks: int
