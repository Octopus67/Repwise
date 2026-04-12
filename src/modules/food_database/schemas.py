"""Food database Pydantic request/response schemas."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from src.shared.validators import validate_json_size

logger = logging.getLogger(__name__)

VALID_MICRO_KEYS = {
    "fiber_g",
    "sugar_g",
    "sodium_mg",
    "potassium_mg",
    "calcium_mg",
    "iron_mg",
    "vitamin_a_iu",
    "vitamin_c_mg",
    "vitamin_d_iu",
    "vitamin_b12_mcg",
    "zinc_mg",
    "magnesium_mg",
    "cholesterol_mg",
    "saturated_fat_g",
    "trans_fat_g",
    "omega3_g",
    "omega6_g",
}


def _validate_micro_nutrient_values(v):
    """Validate micro_nutrients dict: reject negatives, warn on unknown keys."""
    if v is None:
        return v
    v = validate_json_size(v)
    for key, val in v.items():
        if val < 0:
            raise ValueError(f"Micronutrient '{key}' cannot be negative, got {val}")
        if key not in VALID_MICRO_KEYS:
            logger.warning(
                "Unknown micronutrient key '%s' — allowing for import compatibility", key
            )
    return v


# Valid units for recipe ingredients
VALID_UNITS = Literal["g", "ml", "oz", "cup", "tbsp", "tsp", "piece", "serving"]


# ---------------------------------------------------------------------------
# Food Items
# ---------------------------------------------------------------------------


class FoodItemCreate(BaseModel):
    """Payload for creating a food item (admin only)."""

    name: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=100)
    region: str = Field(default="IN", max_length=50)
    serving_size: float = Field(default=100.0, gt=0)
    serving_unit: str = Field(default="g", max_length=20)
    calories: float = Field(ge=0, le=50000)
    protein_g: float = Field(ge=0, le=5000)
    carbs_g: float = Field(ge=0, le=5000)
    fat_g: float = Field(ge=0, le=5000)
    micro_nutrients: Optional[dict[str, float]] = None
    is_recipe: bool = False
    source: Literal["usda", "verified", "community", "custom", "off"] = "custom"
    barcode: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=2000)
    total_servings: Optional[float] = None

    @field_validator("micro_nutrients")
    @classmethod
    def validate_micro_nutrients_size(cls, v):
        return _validate_micro_nutrient_values(v)


class FoodItemUpdate(BaseModel):
    """Payload for updating a food item (admin only). All fields optional."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    category: Optional[str] = Field(default=None, min_length=1, max_length=100)
    region: Optional[str] = Field(default=None, max_length=50)
    serving_size: Optional[float] = Field(default=None, gt=0)
    serving_unit: Optional[str] = Field(default=None, max_length=20)
    calories: Optional[float] = Field(default=None, ge=0, le=50000)
    protein_g: Optional[float] = Field(default=None, ge=0, le=5000)
    carbs_g: Optional[float] = Field(default=None, ge=0, le=5000)
    fat_g: Optional[float] = Field(default=None, ge=0, le=5000)
    micro_nutrients: Optional[dict[str, float]] = None

    @field_validator("micro_nutrients")
    @classmethod
    def validate_micro_nutrients_size(cls, v):
        return _validate_micro_nutrient_values(v)


class FoodItemResponse(BaseModel):
    """Public representation of a food item."""

    id: uuid.UUID
    name: str
    category: str
    region: str
    serving_size: float
    serving_unit: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    micro_nutrients: Optional[dict[str, Any]] = None
    is_recipe: bool
    source: str
    barcode: Optional[str] = None
    description: Optional[str] = None
    total_servings: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Recipe Ingredients
# ---------------------------------------------------------------------------


class RecipeIngredientResponse(BaseModel):
    """Public representation of a recipe ingredient."""

    id: uuid.UUID
    recipe_id: uuid.UUID
    food_item_id: uuid.UUID
    quantity: float
    unit: str
    food_item: Optional[FoodItemResponse] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Recipe with aggregated nutrition
# ---------------------------------------------------------------------------


class RecipeNutrition(BaseModel):
    """Aggregated nutritional values for a recipe."""

    total_calories: float
    total_protein_g: float
    total_carbs_g: float
    total_fat_g: float
    total_micro_nutrients: dict[str, float]


class RecipeDetailResponse(BaseModel):
    """Full recipe detail with ingredients and aggregated nutrition."""

    recipe: FoodItemResponse
    ingredients: list[RecipeIngredientResponse]
    nutrition: RecipeNutrition


# ---------------------------------------------------------------------------
# Recipe CRUD request schemas
# ---------------------------------------------------------------------------


class RecipeIngredientInput(BaseModel):
    """Input for a single ingredient when creating/updating a recipe."""

    food_item_id: uuid.UUID
    quantity: float = Field(gt=0)
    unit: VALID_UNITS = Field(default="g")


class RecipeCreateRequest(BaseModel):
    """Payload for creating a new recipe."""

    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=2000)
    total_servings: float = Field(ge=0.25, le=1000)
    ingredients: list[RecipeIngredientInput] = Field(min_length=1)


class RecipeUpdateRequest(BaseModel):
    """Payload for updating an existing recipe. All fields optional."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=2000)
    total_servings: Optional[float] = Field(default=None, ge=0.25, le=1000)
    ingredients: Optional[list[RecipeIngredientInput]] = None


# ---------------------------------------------------------------------------
# Barcode Lookup
# ---------------------------------------------------------------------------


class BarcodeResponse(BaseModel):
    """Response from a barcode lookup."""

    found: bool
    food_item: Optional[FoodItemResponse] = None
    source: Optional[str] = None  # "cache", "off", "usda"
