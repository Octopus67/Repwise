"""Pydantic schemas for health report operations."""

from __future__ import annotations
from typing import Optional

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class MarkerRange(BaseModel):
    """Reference range for a single health marker."""

    min_normal: float
    max_normal: float
    unit: str = ""


class MarkerResult(BaseModel):
    """Classification result for a single health marker."""

    value: float
    status: str  # "low", "normal", "high"
    min_normal: float
    max_normal: float


class HealthReportCreate(BaseModel):
    """Schema for uploading a new health report."""

    report_date: date
    markers: dict[str, float] = Field(default_factory=dict)
    source_file_url: Optional[str] = None


class HealthReportResponse(BaseModel):
    """Schema for returning a health report in API responses."""

    id: uuid.UUID
    user_id: uuid.UUID
    report_date: date
    markers: Optional[dict[str, float]] = None
    flagged_markers: Optional[dict[str, MarkerResult]] = None
    is_sample: bool
    source_file_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class NutritionCorrelation(BaseModel):
    """A correlation between a flagged marker and nutrition data."""

    marker_name: str
    marker_status: str
    related_nutrient: str
    average_intake: float
    recommended_intake: float
    deficit_percentage: float


class MarkerReferenceRangeResponse(BaseModel):
    """Schema for returning a marker reference range."""

    id: uuid.UUID
    marker_name: str
    unit: str
    min_normal: float
    max_normal: float
    category: str

    model_config = {"from_attributes": True}
