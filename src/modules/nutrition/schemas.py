"""Pydantic schemas for nutrition entry CRUD operations."""

from __future__ import annotations
from typing import Optional

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator


class NutritionEntryCreate(BaseModel):
    """Schema for creating a new nutrition entry.

    All numeric fields enforce >= 0 (Requirement 3.5).
    micro_nutrients is optional JSONB for extensibility (Requirement 3.6).
    """

    meal_name: str = Field(..., min_length=1, max_length=255)
    calories: float = Field(..., ge=0, le=50000)
    protein_g: float = Field(..., ge=0, le=5000)
    carbs_g: float = Field(..., ge=0, le=5000)
    fat_g: float = Field(..., ge=0, le=5000)
    micro_nutrients: Optional[dict[str, float]] = None
    entry_date: date
    source_meal_id: Optional[uuid.UUID] = None

    @model_validator(mode='after')
    def validate_micro_nutrients(self) -> 'NutritionEntryCreate':
        if self.micro_nutrients:
            for key, val in self.micro_nutrients.items():
                if len(key) > 100:
                    raise ValueError(f'micro_nutrient key too long: {key[:20]}...')
                if val < 0:
                    raise ValueError(f'micro_nutrient value must be >= 0: {key}')
        return self


class NutritionEntryUpdate(BaseModel):
    """Schema for updating an existing nutrition entry.

    All fields are optional — only provided fields are updated.
    """

    meal_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    calories: Optional[float] = Field(default=None, ge=0, le=50000)
    protein_g: Optional[float] = Field(default=None, ge=0, le=5000)
    carbs_g: Optional[float] = Field(default=None, ge=0, le=5000)
    fat_g: Optional[float] = Field(default=None, ge=0, le=5000)
    micro_nutrients: Optional[dict[str, float]] = None
    entry_date: Optional[date] = None
    source_meal_id: Optional[uuid.UUID] = None


class NewlyUnlockedAchievement(BaseModel):
    """Achievement unlocked during this request."""

    achievement_id: str
    title: str
    description: str
    icon: str
    category: str


class NutritionEntryResponse(BaseModel):
    """Schema for returning a nutrition entry in API responses."""

    id: uuid.UUID
    user_id: uuid.UUID
    meal_name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    micro_nutrients: Optional[dict[str, float]] = None
    entry_date: date
    source_meal_id: Optional[uuid.UUID] = None
    newly_unlocked: list[NewlyUnlockedAchievement] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DateRangeFilter(BaseModel):
    """Filter for querying entries within a date range."""

    start_date: date
    end_date: date

    @model_validator(mode='after')
    def start_before_end(self) -> 'DateRangeFilter':
        if self.start_date > self.end_date:
            raise ValueError('start_date must be <= end_date')
        return self


class BatchEntryItem(BaseModel):
    """A single item within a batch entry create request."""

    calories: float = Field(..., ge=0, le=50000)
    protein_g: float = Field(..., ge=0, le=5000)
    carbs_g: float = Field(..., ge=0, le=5000)
    fat_g: float = Field(..., ge=0, le=5000)
    micro_nutrients: Optional[dict[str, float]] = None
    source_meal_id: Optional[uuid.UUID] = None


class BatchEntryCreate(BaseModel):
    """Schema for creating multiple nutrition entries atomically as a meal.

    All entries share the same meal_name and entry_date.
    Max 50 items per batch (no realistic meal has 50+ components).
    """

    meal_name: str = Field(..., min_length=1, max_length=255)
    entry_date: date
    entries: list[BatchEntryItem] = Field(..., min_length=1, max_length=50)


class CopyEntriesRequest(BaseModel):
    """Schema for copying entries from one date to another."""

    source_date: date
    target_date: date

    @model_validator(mode='after')
    def dates_must_differ(self) -> 'CopyEntriesRequest':
        if self.source_date == self.target_date:
            raise ValueError('source_date and target_date must be different')
        return self
