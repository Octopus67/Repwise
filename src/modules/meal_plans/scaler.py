"""Pure recipe scaling functions — no DB access, no side effects."""

from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass(frozen=True)
class IngredientInput:
    food_item_id: uuid.UUID
    name: str
    quantity: float
    unit: str


@dataclass(frozen=True)
class ScaledIngredient:
    food_item_id: uuid.UUID
    name: str
    original_quantity: float
    scaled_quantity: float
    unit: str


@dataclass(frozen=True)
class ScaledRecipe:
    original_recipe_id: uuid.UUID
    scale_factor: float
    ingredients: list[ScaledIngredient]
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float


def compute_scale_factor(original_value: float, target_value: float) -> float:
    """Compute target / original. Raises ValueError if original <= 0."""
    if original_value <= 0:
        raise ValueError(f"Cannot scale from non-positive value: {original_value}")
    return target_value / original_value


def scale_recipe(
    recipe_id: uuid.UUID,
    recipe_calories: float,
    recipe_protein_g: float,
    recipe_carbs_g: float,
    recipe_fat_g: float,
    ingredients: list[IngredientInput],
    target_value: float,
    target_macro: str = "calories",
) -> ScaledRecipe:
    """Scale all ingredients and macros by target/original ratio."""
    macro_map = {
        "calories": recipe_calories,
        "protein_g": recipe_protein_g,
        "carbs_g": recipe_carbs_g,
        "fat_g": recipe_fat_g,
    }
    original = macro_map.get(target_macro)
    if original is None:
        raise ValueError(f"Unknown target_macro: {target_macro}")

    factor = compute_scale_factor(original, target_value)

    scaled_ingredients = [
        ScaledIngredient(
            food_item_id=ing.food_item_id,
            name=ing.name,
            original_quantity=ing.quantity,
            scaled_quantity=round(ing.quantity * factor, 2),
            unit=ing.unit,
        )
        for ing in ingredients
    ]

    return ScaledRecipe(
        original_recipe_id=recipe_id,
        scale_factor=round(factor, 6),
        ingredients=scaled_ingredients,
        calories=round(recipe_calories * factor, 2),
        protein_g=round(recipe_protein_g * factor, 2),
        carbs_g=round(recipe_carbs_g * factor, 2),
        fat_g=round(recipe_fat_g * factor, 2),
    )
