"""Meal plan Pydantic request/response schemas."""

import uuid
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class GeneratePlanRequest(BaseModel):
    slot_splits: Optional[dict[str, float]] = Field(
        default=None,
        description="Slot name → fraction of daily macros. Values must be positive and sum to ~1.0.",
    )
    num_days: int = Field(default=5, ge=1, le=14)


class MealAssignmentPayload(BaseModel):
    slot: str = Field(min_length=1, max_length=50)
    food_item_id: uuid.UUID
    name: str = Field(default="", max_length=255)
    scale_factor: float = Field(default=1.0, ge=0.0, le=100.0)
    calories: float = Field(default=0.0, ge=0.0, le=50_000.0)
    protein_g: float = Field(default=0.0, ge=0.0, le=5_000.0)
    carbs_g: float = Field(default=0.0, ge=0.0, le=5_000.0)
    fat_g: float = Field(default=0.0, ge=0.0, le=5_000.0)
    is_recipe: bool = False


class DayPlanPayload(BaseModel):
    day_index: int = Field(ge=0, le=13)
    assignments: list[MealAssignmentPayload] = Field(default_factory=list, max_length=50)
    unfilled_slots: list[str] = Field(default_factory=list, max_length=50)


class SavePlanRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    start_date: date
    days: list[DayPlanPayload]
    slot_splits: Optional[dict[str, float]] = None


class DuplicatePlanRequest(BaseModel):
    new_start_date: date


class ScaleRecipeRequest(BaseModel):
    recipe_id: uuid.UUID
    target_value: float = Field(gt=0, le=50_000.0)
    target_macro: Literal["calories", "protein_g", "carbs_g", "fat_g"] = "calories"


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class MacroSummaryResponse(BaseModel):
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float


class MealPlanItemResponse(BaseModel):
    id: uuid.UUID
    plan_id: uuid.UUID
    day_index: int
    slot: str
    food_item_id: uuid.UUID
    scale_factor: float
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    created_at: datetime

    model_config = {"from_attributes": True}


class MealPlanResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    start_date: date
    num_days: int
    slot_splits: dict[str, float]
    weekly_calories: float
    weekly_protein_g: float
    weekly_carbs_g: float
    weekly_fat_g: float
    items: list[MealPlanItemResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MealAssignmentResponse(BaseModel):
    slot: str
    food_item_id: uuid.UUID
    name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    scale_factor: float
    is_recipe: bool


class DayPlanResponse(BaseModel):
    day_index: int
    assignments: list[MealAssignmentResponse]
    unfilled_slots: list[str]
    summary: MacroSummaryResponse


class GeneratedPlanResponse(BaseModel):
    days: list[DayPlanResponse]
    daily_macro_summaries: list[MacroSummaryResponse]
    weekly_macro_summary: MacroSummaryResponse


class ScaledIngredientResponse(BaseModel):
    food_item_id: uuid.UUID
    name: str
    original_quantity: float
    scaled_quantity: float
    unit: str


class ScaledRecipeResponse(BaseModel):
    original_recipe_id: uuid.UUID
    scale_factor: float
    ingredients: list[ScaledIngredientResponse]
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float


class ShoppingItemResponse(BaseModel):
    name: str
    quantity: float
    unit: str
    category: str


class ShoppingListResponse(BaseModel):
    items: list[ShoppingItemResponse]
