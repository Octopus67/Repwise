"""Pydantic schemas for daily step tracking module."""

from __future__ import annotations

import uuid
from datetime import date as date_type

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SyncStepsRequest(BaseModel):
    """Request body for syncing a day's step data."""

    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    step_count: int = Field(..., ge=0)
    step_goal: int = Field(default=8000, ge=1000)

    @field_validator("date")
    @classmethod
    def date_must_be_real(cls, v: str) -> str:
        date_type.fromisoformat(v)
        return v


class DailyStepsResponse(BaseModel):
    """Response body for a daily step entry."""

    id: uuid.UUID
    date: str
    step_count: int
    step_goal: int

    model_config = ConfigDict(from_attributes=True)


class StepsHistoryResponse(BaseModel):
    """Response body for step history list."""

    items: list[DailyStepsResponse]
