"""Readiness module Pydantic request/response schemas."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class HealthMetricsRequest(BaseModel):
    hrv_ms: Optional[float] = Field(None, ge=0, le=300)
    resting_hr_bpm: Optional[float] = Field(None, ge=20, le=220)
    sleep_duration_hours: Optional[float] = Field(None, ge=0, le=24)


class CheckinRequest(BaseModel):
    soreness: int = Field(ge=1, le=5)
    stress: int = Field(ge=1, le=5)
    sleep_quality: int = Field(ge=1, le=5)
    checkin_date: date


class CheckinResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    soreness: int
    stress: int
    sleep_quality: int
    checkin_date: date
    created_at: datetime

    model_config = {"from_attributes": True}


class FactorScoreResponse(BaseModel):
    name: str
    normalized: float
    weight: float
    effective_weight: float
    present: bool

    @field_validator("normalized")
    @classmethod
    def clamp_normalized(cls, v: float) -> float:
        return max(0.0, min(float(v), 1.0))


class ReadinessScoreResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    score: Optional[int] = None
    score_date: date
    factors: List[FactorScoreResponse] = Field(default_factory=list)
    factors_present: int
    factors_total: int
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("score")
    @classmethod
    def clamp_score(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return None
        return max(0, min(int(v), 100))


class ReadinessHistoryResponse(BaseModel):
    items: List[ReadinessScoreResponse] = Field(default_factory=list)
    start_date: date
    end_date: date
