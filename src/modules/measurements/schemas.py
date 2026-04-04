"""Pydantic schemas for body measurements module."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class MeasurementCreate(BaseModel):
    """Request body for creating a body measurement."""

    measured_at: datetime
    weight_kg: Optional[float] = Field(None, gt=0, le=500)
    body_fat_pct: Optional[float] = Field(None, ge=0, le=100)
    waist_cm: Optional[float] = Field(None, gt=0, le=300)
    neck_cm: Optional[float] = Field(None, gt=0, le=100)
    hips_cm: Optional[float] = Field(None, gt=0, le=300)
    chest_cm: Optional[float] = Field(None, gt=0, le=300)
    bicep_left_cm: Optional[float] = Field(None, gt=0, le=100)
    bicep_right_cm: Optional[float] = Field(None, gt=0, le=100)
    thigh_left_cm: Optional[float] = Field(None, gt=0, le=150)
    thigh_right_cm: Optional[float] = Field(None, gt=0, le=150)
    calf_left_cm: Optional[float] = Field(None, gt=0, le=100)
    calf_right_cm: Optional[float] = Field(None, gt=0, le=100)
    notes: Optional[str] = Field(None, max_length=1000)


class MeasurementUpdate(BaseModel):
    """Request body for updating a body measurement (partial)."""

    weight_kg: Optional[float] = Field(None, gt=0, le=500)
    body_fat_pct: Optional[float] = Field(None, ge=0, le=100)
    waist_cm: Optional[float] = Field(None, gt=0, le=300)
    neck_cm: Optional[float] = Field(None, gt=0, le=100)
    hips_cm: Optional[float] = Field(None, gt=0, le=300)
    chest_cm: Optional[float] = Field(None, gt=0, le=300)
    bicep_left_cm: Optional[float] = Field(None, gt=0, le=100)
    bicep_right_cm: Optional[float] = Field(None, gt=0, le=100)
    thigh_left_cm: Optional[float] = Field(None, gt=0, le=150)
    thigh_right_cm: Optional[float] = Field(None, gt=0, le=150)
    calf_left_cm: Optional[float] = Field(None, gt=0, le=100)
    calf_right_cm: Optional[float] = Field(None, gt=0, le=100)
    notes: Optional[str] = Field(None, max_length=1000)


class MeasurementResponse(BaseModel):
    """Response body for a body measurement."""

    id: uuid.UUID
    user_id: uuid.UUID
    measured_at: datetime
    weight_kg: Optional[float] = None
    body_fat_pct: Optional[float] = None
    waist_cm: Optional[float] = None
    neck_cm: Optional[float] = None
    hips_cm: Optional[float] = None
    chest_cm: Optional[float] = None
    bicep_left_cm: Optional[float] = None
    bicep_right_cm: Optional[float] = None
    thigh_left_cm: Optional[float] = None
    thigh_right_cm: Optional[float] = None
    calf_left_cm: Optional[float] = None
    calf_right_cm: Optional[float] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PhotoUpload(BaseModel):
    """Metadata for a progress photo upload."""

    photo_type: str = Field(..., pattern=r"^(front|side|back|other)$")
    taken_at: datetime
    is_private: bool = True


class PhotoResponse(BaseModel):
    """Response body for a measurement progress photo."""

    id: uuid.UUID
    user_id: uuid.UUID
    measurement_id: uuid.UUID
    photo_url: str
    photo_type: str
    taken_at: datetime
    is_private: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NavyBFRequest(BaseModel):
    """Request body for Navy body fat calculation."""

    sex: str = Field(..., pattern=r"^(male|female|other)$")
    waist_cm: float = Field(..., gt=0)
    neck_cm: float = Field(..., gt=0)
    height_cm: float = Field(..., gt=0)
    hips_cm: Optional[float] = Field(None, gt=0)

    @model_validator(mode="after")
    def hips_required_for_female(self) -> "NavyBFRequest":
        if self.sex == "female" and self.hips_cm is None:
            raise ValueError("hips_cm is required for female calculation")
        return self


class NavyBFResponse(BaseModel):
    """Response body for Navy body fat calculation."""

    body_fat_pct: float
    formula: str = "navy"


class TrendPoint(BaseModel):
    """A single data point in a measurement trend."""

    measured_at: datetime
    weight_kg: Optional[float] = None
    body_fat_pct: Optional[float] = None
    waist_cm: Optional[float] = None
    neck_cm: Optional[float] = None
    chest_cm: Optional[float] = None
