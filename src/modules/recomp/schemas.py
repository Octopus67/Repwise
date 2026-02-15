"""Recomp module Pydantic schemas."""

from __future__ import annotations
from typing import Optional

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator


# Upper bounds based on realistic human measurements
MAX_WAIST_CM = 200.0
MAX_ARM_CM = 80.0
MAX_CHEST_CM = 200.0


class RecompMeasurementCreate(BaseModel):
    recorded_date: date
    waist_cm: Optional[float] = Field(None, gt=0, le=MAX_WAIST_CM)
    arm_cm: Optional[float] = Field(None, gt=0, le=MAX_ARM_CM)
    chest_cm: Optional[float] = Field(None, gt=0, le=MAX_CHEST_CM)

    @model_validator(mode="after")
    def at_least_one_measurement(self) -> "RecompMeasurementCreate":
        if self.waist_cm is None and self.arm_cm is None and self.chest_cm is None:
            raise ValueError("At least one measurement must be provided")
        return self


class RecompMeasurementResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    recorded_date: date
    waist_cm: Optional[float] = None
    arm_cm: Optional[float] = None
    chest_cm: Optional[float] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class TrendResponse(BaseModel):
    slope_per_week: float
    direction: str
    data_points: int


class RecompMetricsResponse(BaseModel):
    waist_trend: Optional[TrendResponse] = None
    arm_trend: Optional[TrendResponse] = None
    chest_trend: Optional[TrendResponse] = None
    weight_trend: Optional[TrendResponse] = None
    muscle_gain_indicator: Optional[float] = None
    fat_loss_indicator: Optional[float] = None
    recomp_score: Optional[float] = None
    has_sufficient_data: bool


class RecompCheckinResponse(BaseModel):
    recommendation: str
    recomp_score: Optional[float] = None
    suggested_surplus_adjustment: Optional[float] = None
    suggested_deficit_adjustment: Optional[float] = None
