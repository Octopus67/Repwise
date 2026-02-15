"""Food database Pydantic request/response schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


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
    calories: float = Field(ge=0)
    protein_g: float = Field(ge=0)
    carbs_g: float = Field(ge=0)
    fat_g: float = Field(ge=0)
    micro_nutrients: Optional[dict[str, float]] = None
    is_recipe: bool = False
    source: Literal["usda", "verified", "community", "custom", "off"] = "custom"
    barcode: Optional[str] = None
    description: Optional[str] = None
    total_servings: Optional[float] = None


class FoodItemUpdate(BaseModel):
    """Payload for updating a food item (admin only). All fields optional."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    category: Optional[str] = Field(default=None, min_length=1, max_length=100)
    region: Optional[str] = Field(default=None, max_length=50)
    serving_size: Optional[float] = Field(default=None, gt=0)
    serving_unit: Optional[str] = Field(default=None, max_length=20)
    calories: Optional[float] = Field(default=None, ge=0)
    protein_g: Optional[float] = Field(default=None, ge=0)
    carbs_g: Optional[float] = Field(default=None, ge=0)
    fat_g: Optional[float] = Field(default=None, ge=0)
    micro_nutrients: Optional[dict[str, float]] = None


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
    unit: str = Field(default="g", max_length=20)


class RecipeCreateRequest(BaseModel):
    """Payload for creating a new recipe."""

    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    total_servings: float = Field(gt=0, le=1000)
    ingredients: list[RecipeIngredientInput] = Field(min_length=1)


class RecipeUpdateRequest(BaseModel):
    """Payload for updating an existing recipe. All fields optional."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    total_servings: Optional[float] = Field(default=None, gt=0, le=1000)
    ingredients: Optional[list[RecipeIngredientInput]] = None


# ---------------------------------------------------------------------------
# Barcode Lookup
# ---------------------------------------------------------------------------


class BarcodeResponse(BaseModel):
    """Response from a barcode lookup."""

    found: bool
    food_item: Optional[FoodItemResponse] = None
    source: Optional[str] = None  # "cache", "off", "usda"
