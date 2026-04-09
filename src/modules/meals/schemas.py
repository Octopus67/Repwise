"""Meal library Pydantic request/response schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator
from typing import Optional

from src.shared.sanitize import strip_html


# ---------------------------------------------------------------------------
# Custom Meals
# ---------------------------------------------------------------------------

class CustomMealCreate(BaseModel):
    """Payload for creating a custom meal."""

    name: str = Field(min_length=1, max_length=255)
    calories: float = Field(ge=0, le=50000)
    protein_g: float = Field(ge=0, le=5000)
    carbs_g: float = Field(ge=0, le=5000)
    fat_g: float = Field(ge=0, le=5000)
    micro_nutrients: Optional[dict[str, float]] = None

    @field_validator("name", mode="before")
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        """Strip HTML from meal name."""
        return strip_html(v) if isinstance(v, str) else v


class CustomMealUpdate(BaseModel):
    """Payload for updating a custom meal. All fields optional."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    calories: Optional[float] = Field(default=None, ge=0, le=50000)
    protein_g: Optional[float] = Field(default=None, ge=0, le=5000)
    carbs_g: Optional[float] = Field(default=None, ge=0, le=5000)
    fat_g: Optional[float] = Field(default=None, ge=0, le=5000)
    micro_nutrients: Optional[dict[str, float]] = None

    @field_validator("name", mode="before")
    @classmethod
    def sanitize_name(cls, v: str | None) -> str | None:
        """Strip HTML from meal name."""
        return strip_html(v) if isinstance(v, str) else v


class CustomMealResponse(BaseModel):
    """Public representation of a custom meal."""

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    micro_nutrients: Optional[dict[str, float]] = None
    source_type: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Meal Favorites
# ---------------------------------------------------------------------------

class MealFavoriteCreate(BaseModel):
    """Payload for adding a meal to favorites.

    Provide *either* ``meal_id`` (custom meal) or ``food_item_id``
    (food database item).  The nutritional snapshot fields are required
    so the favorite can be used for pre-filling nutrition entries.
    """

    meal_id: Optional[uuid.UUID] = None
    food_item_id: Optional[uuid.UUID] = None
    name: str = Field(min_length=1, max_length=255)
    calories: float = Field(ge=0, le=50000)
    protein_g: float = Field(ge=0, le=50000)
    carbs_g: float = Field(ge=0, le=50000)
    fat_g: float = Field(ge=0, le=50000)
    micro_nutrients: Optional[dict[str, float]] = None

    @field_validator("name", mode="before")
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        """Strip HTML from favorite name."""
        return strip_html(v) if isinstance(v, str) else v


class MealFavoriteResponse(BaseModel):
    """Public representation of a meal favorite."""

    id: uuid.UUID
    user_id: uuid.UUID
    meal_id: Optional[uuid.UUID] = None
    food_item_id: Optional[uuid.UUID] = None
    name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    micro_nutrients: Optional[dict[str, float]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Pre-fill helper (NutritionEntryCreate-compatible dict)
# ---------------------------------------------------------------------------

class NutritionEntryPreFill(BaseModel):
    """Pre-filled nutrition entry values derived from a custom meal or favorite.

    This is compatible with NutritionEntryCreate so it can be spread
    directly into a nutrition log request.
    """

    meal_name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    micro_nutrients: Optional[dict[str, float]] = None
    source_meal_id: Optional[uuid.UUID] = None
