"""Pydantic schemas for the Monthly Recap Report."""

from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class MonthlyTrainingMetrics(BaseModel):
    total_volume: float = Field(default=0.0, ge=0)
    session_count: int = Field(default=0, ge=0)
    volume_by_muscle_group: dict[str, float] = Field(default_factory=dict)


class MonthlyNutritionMetrics(BaseModel):
    avg_calories: float = Field(default=0.0, ge=0)
    avg_protein_g: float = Field(default=0.0, ge=0)
    avg_carbs_g: float = Field(default=0.0, ge=0)
    avg_fat_g: float = Field(default=0.0, ge=0)
    compliance_pct: float = Field(default=0.0, ge=0, le=100)
    days_logged: int = Field(default=0, ge=0)


class MonthlyBodyMetrics(BaseModel):
    start_weight_kg: Optional[float] = Field(default=None, ge=20, le=500)
    end_weight_kg: Optional[float] = Field(default=None, ge=20, le=500)
    weight_change_kg: Optional[float] = None


class MomDelta(BaseModel):
    """Month-over-month deltas (current − previous)."""

    volume_delta: float = 0.0
    session_delta: int = 0
    avg_calories_delta: float = 0.0
    avg_protein_delta: float = 0.0
    compliance_delta: float = 0.0
    weight_change_delta: Optional[float] = None


class MonthlyReportResponse(BaseModel):
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    month_start: date
    month_end: date
    training: MonthlyTrainingMetrics
    nutrition: MonthlyNutritionMetrics
    body: MonthlyBodyMetrics
    previous_month_delta: MomDelta
