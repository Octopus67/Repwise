"""Pydantic schemas for the Weekly Intelligence Report."""

from __future__ import annotations
from typing import Optional

from dataclasses import dataclass, field
from datetime import date

from pydantic import BaseModel, Field

from src.modules.training.analytics_schemas import PersonalRecord


class TrainingMetrics(BaseModel):
    total_volume: float = Field(default=0.0, ge=0, le=1_000_000)
    volume_by_muscle_group: dict[str, float] = Field(default_factory=dict)
    session_count: int = Field(default=0, ge=0, le=100)
    personal_records: list[PersonalRecord] = Field(default_factory=list)


class NutritionMetrics(BaseModel):
    avg_calories: float = Field(default=0.0, ge=0, le=50_000)
    avg_protein_g: float = Field(default=0.0, ge=0, le=5_000)
    avg_carbs_g: float = Field(default=0.0, ge=0, le=5_000)
    avg_fat_g: float = Field(default=0.0, ge=0, le=5_000)
    target_calories: float = Field(default=0.0, ge=0, le=50_000)
    compliance_pct: float = Field(default=0.0, ge=0, le=100)
    tdee_delta: Optional[float] = None
    days_logged: int = Field(default=0, ge=0, le=7)


class BodyMetrics(BaseModel):
    start_weight_kg: Optional[float] = Field(default=None, ge=20, le=500)
    end_weight_kg: Optional[float] = Field(default=None, ge=20, le=500)
    weight_trend_kg: Optional[float] = None


class WeeklyReportResponse(BaseModel):
    year: int = Field(ge=2000, le=2100)
    week: int = Field(ge=1, le=53)
    week_start: date
    week_end: date
    training: TrainingMetrics
    nutrition: NutritionMetrics
    body: BodyMetrics
    recommendations: list[str] = Field(default_factory=list)


@dataclass(frozen=True)
class ReportContext:
    volume_by_muscle_group: dict[str, float] = field(default_factory=dict)
    sets_by_muscle_group: dict[str, int] = field(default_factory=dict)
    session_count: int = 0
    prs: list[PersonalRecord] = field(default_factory=list)
    avg_calories: float = 0.0
    target_calories: float = 0.0
    compliance_pct: float = 0.0
    weight_trend: Optional[float] = None
    goal_type: str = "maintaining"
    goal_rate_per_week: Optional[float] = None
    days_logged_nutrition: int = 0
    days_logged_training: int = 0
