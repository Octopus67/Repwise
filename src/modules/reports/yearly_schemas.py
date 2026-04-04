"""Pydantic schemas for the Year in Review Report."""

from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class YearlyTrainingMetrics(BaseModel):
    total_volume: float = Field(default=0.0, ge=0)
    session_count: int = Field(default=0, ge=0)
    volume_by_muscle_group: dict[str, float] = Field(default_factory=dict)


class YearlyNutritionMetrics(BaseModel):
    avg_calories: float = Field(default=0.0, ge=0)
    avg_protein_g: float = Field(default=0.0, ge=0)
    avg_carbs_g: float = Field(default=0.0, ge=0)
    avg_fat_g: float = Field(default=0.0, ge=0)
    compliance_pct: float = Field(default=0.0, ge=0, le=100)
    days_logged: int = Field(default=0, ge=0)


class YearlyBodyMetrics(BaseModel):
    start_weight_kg: Optional[float] = Field(default=None, ge=20, le=500)
    end_weight_kg: Optional[float] = Field(default=None, ge=20, le=500)
    weight_change_kg: Optional[float] = None


class YearlyReportResponse(BaseModel):
    year: int = Field(ge=2000, le=2100)
    year_start: date
    year_end: date
    training: YearlyTrainingMetrics
    nutrition: YearlyNutritionMetrics
    body: YearlyBodyMetrics
    total_workouts: int = Field(default=0, ge=0)
    total_prs: int = Field(default=0, ge=0)
    longest_streak: int = Field(default=0, ge=0)
    most_trained_muscle: Optional[str] = None
