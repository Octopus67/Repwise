"""Recipe sub-service — CRUD, nutritional aggregation, and circular reference detection."""

from __future__ import annotations

import uuid
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.modules.food_database.models import FoodItem, RecipeIngredient
from src.modules.food_database.schemas import (
    FoodItemResponse,
    RecipeDetailResponse,
    RecipeIngredientInput,
    RecipeIngredientResponse,
    RecipeNutrition,
)
from src.shared.errors import ForbiddenError, NotFoundError, ValidationError
from src.shared.pagination import PaginatedResult, PaginationParams


class RecipeService:
    """Handles recipe CRUD, ingredient management, and nutritional aggregation."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Helper methods
    # ------------------------------------------------------------------

    async def _has_circular_reference(
        self,
        recipe_id: uuid.UUID,
        ingredient_id: uuid.UUID,
        visited: Optional[set] = None,
        depth: int = 0,
    ) -> bool:
        """Check if adding ingredient_id to recipe_id would create a circular reference."""
        if depth > 10:  # Prevent infinite recursion
            return True

        if visited is None:
            visited = set()

        if ingredient_id in visited:
            return True

        # Check if the ingredient is a recipe
        stmt = select(FoodItem).where(FoodItem.id == ingredient_id, FoodItem.is_recipe.is_(True))
        stmt = FoodItem.not_deleted(stmt)
        result = await self.db.execute(stmt)
        ingredient_recipe = result.scalar_one_or_none()

        if ingredient_recipe is None:
            return False  # Not a recipe, no circular reference possible

        # If the ingredient recipe contains our original recipe, it's circular
        if ingredient_id == recipe_id:
            return True

        # Check all ingredients of this recipe recursively
        visited.add(ingredient_id)
        ing_stmt = select(RecipeIngredient).where(RecipeIngredient.recipe_id == ingredient_id)
        ing_result = await self.db.execute(ing_stmt)

        for ing in ing_result.scalars().all():
            if await self._has_circular_reference(
                recipe_id, ing.food_item_id, visited.copy(), depth + 1
            ):
                return True

        return False

    # ------------------------------------------------------------------
    # Recipe CRUD
    # ------------------------------------------------------------------

    async def create_recipe(
        self,
        user_id: uuid.UUID,
        name: str,
        description: Optional[str],
        total_servings: float,
        ingredients: list[RecipeIngredientInput],
    ) -> FoodItem:
        """Create a recipe as a FoodItem with is_recipe=True.

        1. Create FoodItem(is_recipe=True, source='custom', total_servings)
        2. Create RecipeIngredient rows for each ingredient
        3. Compute aggregate nutrition via aggregate_recipe_nutrition()
        4. Store per-serving macros on FoodItem (denormalized for search)
        """
        # Create the recipe FoodItem
        recipe = FoodItem(
            name=name,
            description=description,
            category="Recipe",
            region="Custom",
            serving_size=100.0,  # placeholder — per-serving macros are denormalized
            serving_unit="serving",
            calories=0,
            protein_g=0,
            carbs_g=0,
            fat_g=0,
            is_recipe=True,
            source="custom",
            total_servings=total_servings,
            created_by=user_id,
        )
        self.db.add(recipe)
        await self.db.flush()
        await self.db.refresh(recipe)

        # Create ingredient rows, preventing circular references
        # Audit fix 4.1 — batch fetch to fix N+1
        all_food_ids = [ing.food_item_id for ing in ingredients]
        batch_stmt = select(FoodItem).where(FoodItem.id.in_(all_food_ids))
        batch_stmt = FoodItem.not_deleted(batch_stmt)
        batch_result = await self.db.execute(batch_stmt)
        food_lookup = {f.id: f for f in batch_result.scalars().all()}

        ingredient_rows: list[RecipeIngredient] = []
        for ing in ingredients:
            if ing.food_item_id == recipe.id:
                raise ValidationError("A recipe cannot contain itself as an ingredient")

            # Check for circular references recursively
            if await self._has_circular_reference(recipe.id, ing.food_item_id):
                raise ValidationError("Adding this ingredient would create a circular reference")

            # Verify ingredient exists and is not deleted
            food = food_lookup.get(ing.food_item_id)
            if food is None:
                raise NotFoundError(f"Ingredient food item {ing.food_item_id} not found")

            row = RecipeIngredient(
                recipe_id=recipe.id,
                food_item_id=ing.food_item_id,
                quantity=ing.quantity,
                unit=ing.unit,
            )
            self.db.add(row)
            ingredient_rows.append(row)

        await self.db.flush()

        # Reload ingredients with food_item relationship for aggregation
        stmt = (
            select(RecipeIngredient)
            .where(RecipeIngredient.recipe_id == recipe.id)
            .options(selectinload(RecipeIngredient.food_item))
        )
        result = await self.db.execute(stmt)
        loaded_ingredients = list(result.scalars().all())

        # Compute aggregate nutrition and denormalize per-serving macros
        nutrition = aggregate_recipe_nutrition(loaded_ingredients)
        recipe.calories = nutrition.total_calories / total_servings
        recipe.protein_g = nutrition.total_protein_g / total_servings
        recipe.carbs_g = nutrition.total_carbs_g / total_servings
        recipe.fat_g = nutrition.total_fat_g / total_servings

        await self.db.flush()
        await self.db.refresh(recipe)
        return recipe

    async def list_user_recipes(
        self,
        user_id: uuid.UUID,
        pagination: PaginationParams,
    ) -> PaginatedResult[Any]:
        """List recipes created by this user (FoodItems with is_recipe=True)."""
        base = select(FoodItem).where(
            FoodItem.is_recipe.is_(True),
            FoodItem.created_by == user_id,
        )
        base = FoodItem.not_deleted(base)

        count_stmt = select(func.count()).select_from(base.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        items_stmt = (
            base.order_by(FoodItem.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        result = await self.db.execute(items_stmt)
        items = list(result.scalars().all())

        return PaginatedResult(
            items=items,
            total_count=total,
            page=pagination.page,
            limit=pagination.limit,
        )

    async def update_recipe(
        self,
        user_id: uuid.UUID,
        recipe_id: uuid.UUID,
        name: Optional[str] = None,
        description: Optional[str] = None,
        total_servings: Optional[float] = None,
        ingredients: Optional[list[RecipeIngredientInput]] = None,
    ) -> FoodItem:
        """Update a recipe's name, description, servings, or ingredients.

        Recomputes nutrition if ingredients or total_servings change.
        Only the recipe owner can update.
        """
        stmt = select(FoodItem).where(
            FoodItem.id == recipe_id,
            FoodItem.is_recipe.is_(True),
        )
        stmt = FoodItem.not_deleted(stmt)
        result = await self.db.execute(stmt)
        recipe = result.scalar_one_or_none()
        if recipe is None:
            raise NotFoundError("Recipe not found")

        if recipe.created_by != user_id:
            raise ForbiddenError("Only the recipe owner can update this recipe")

        if name is not None:
            recipe.name = name
        if description is not None:
            recipe.description = description
        if total_servings is not None:
            recipe.total_servings = total_servings

        # Replace ingredients if provided
        if ingredients is not None:
            # Delete existing ingredients
            existing_stmt = select(RecipeIngredient).where(RecipeIngredient.recipe_id == recipe_id)
            existing_result = await self.db.execute(existing_stmt)
            for old_ing in existing_result.scalars().all():
                await self.db.delete(old_ing)
            await self.db.flush()

            # Create new ingredient rows
            # Audit fix 4.1 — batch fetch to fix N+1
            all_food_ids = [ing.food_item_id for ing in ingredients]
            batch_stmt = select(FoodItem).where(FoodItem.id.in_(all_food_ids))
            batch_stmt = FoodItem.not_deleted(batch_stmt)
            batch_result = await self.db.execute(batch_stmt)
            food_lookup = {f.id: f for f in batch_result.scalars().all()}

            for ing in ingredients:
                if ing.food_item_id == recipe_id:
                    raise ValidationError("A recipe cannot contain itself as an ingredient")

                # Check for circular references recursively
                if await self._has_circular_reference(recipe_id, ing.food_item_id):
                    raise ValidationError(
                        "Adding this ingredient would create a circular reference"
                    )

                food = food_lookup.get(ing.food_item_id)
                if food is None:
                    raise NotFoundError(f"Ingredient food item {ing.food_item_id} not found")

                row = RecipeIngredient(
                    recipe_id=recipe_id,
                    food_item_id=ing.food_item_id,
                    quantity=ing.quantity,
                    unit=ing.unit,
                )
                self.db.add(row)

            await self.db.flush()

        # Recompute nutrition if ingredients or servings changed
        if ingredients is not None or total_servings is not None:
            reload_stmt = (
                select(RecipeIngredient)
                .where(RecipeIngredient.recipe_id == recipe_id)
                .options(selectinload(RecipeIngredient.food_item))
            )
            reload_result = await self.db.execute(reload_stmt)
            loaded_ingredients = list(reload_result.scalars().all())

            nutrition = aggregate_recipe_nutrition(loaded_ingredients)
            servings = recipe.total_servings or 1.0
            recipe.calories = nutrition.total_calories / servings
            recipe.protein_g = nutrition.total_protein_g / servings
            recipe.carbs_g = nutrition.total_carbs_g / servings
            recipe.fat_g = nutrition.total_fat_g / servings

        await self.db.flush()
        await self.db.refresh(recipe)
        return recipe

    async def delete_recipe(
        self,
        user_id: uuid.UUID,
        recipe_id: uuid.UUID,
    ) -> None:
        """Soft-delete a recipe. Only the owner can delete."""
        from datetime import datetime, timezone

        stmt = select(FoodItem).where(
            FoodItem.id == recipe_id,
            FoodItem.is_recipe.is_(True),
        )
        stmt = FoodItem.not_deleted(stmt)
        result = await self.db.execute(stmt)
        recipe = result.scalar_one_or_none()
        if recipe is None:
            raise NotFoundError("Recipe not found")

        if recipe.created_by != user_id:
            raise ForbiddenError("Only the recipe owner can delete this recipe")

        recipe.deleted_at = datetime.now(timezone.utc)
        await self.db.flush()

    # ------------------------------------------------------------------
    # Recipe with nutritional aggregation
    # ------------------------------------------------------------------

    async def get_recipe(
        self, recipe_id: uuid.UUID, user_id: uuid.UUID | None = None
    ) -> RecipeDetailResponse:
        """Retrieve a recipe with its ingredients and aggregated nutrition.

        Nutritional aggregation: for each ingredient, scale its per-serving
        nutritional values by (quantity / serving_size), then sum across
        all ingredients (Requirement 5.3).
        """
        # Fetch the recipe food item
        stmt = (
            select(FoodItem)
            .where(FoodItem.id == recipe_id, FoodItem.is_recipe.is_(True))
            .options(selectinload(FoodItem.ingredients).selectinload(RecipeIngredient.food_item))
        )
        stmt = FoodItem.not_deleted(stmt)
        result = await self.db.execute(stmt)
        recipe = result.scalar_one_or_none()
        if recipe is None:
            raise NotFoundError("Recipe not found")

        # INVARIANT: System/seeded recipes have created_by=None and are accessible to all users.
        # User-created recipes have created_by set and are only visible to their creator.
        # If seeding logic ever sets created_by, those recipes become invisible to other users.
        if recipe.created_by is not None and user_id is not None and recipe.created_by != user_id:
            raise NotFoundError("Recipe not found")

        # Aggregate nutrition from ingredients
        nutrition = aggregate_recipe_nutrition(recipe.ingredients)

        ingredient_responses = [
            RecipeIngredientResponse(
                id=ing.id,
                recipe_id=ing.recipe_id,
                food_item_id=ing.food_item_id,
                quantity=ing.quantity,
                unit=ing.unit,
                food_item=FoodItemResponse.model_validate(ing.food_item)
                if ing.food_item and ing.food_item.deleted_at is None
                else None,
            )
            for ing in recipe.ingredients
        ]

        return RecipeDetailResponse(
            recipe=FoodItemResponse.model_validate(recipe),
            ingredients=ingredient_responses,
            nutrition=nutrition,
        )


# ---------------------------------------------------------------------------
# Unit conversion helpers
# ---------------------------------------------------------------------------

_GRAM_CONVERSIONS: dict[str, float] = {
    "g": 1.0,
    "kg": 1000.0,
    "oz": 28.3495,
    "lb": 453.592,
}

_ML_CONVERSIONS: dict[str, float] = {
    "ml": 1.0,
    "l": 1000.0,
    "cup": 240.0,
    "tbsp": 15.0,
    "tsp": 5.0,
    "fl_oz": 29.5735,
}


_DIMENSIONLESS_UNITS: set[str] = {"piece", "serving", "whole", "unit", "each"}


def _convert_unit(quantity: float, from_unit: str, to_unit: str) -> float:
    """Convert quantity between compatible units. Returns quantity unchanged if units match or are incompatible."""
    fu = from_unit.lower().strip()
    tu = to_unit.lower().strip()
    if fu == tu:
        return quantity
    # Dimensionless units — treat as 1:1 with each other
    if fu in _DIMENSIONLESS_UNITS and tu in _DIMENSIONLESS_UNITS:
        return quantity
    # Mass conversions
    if fu in _GRAM_CONVERSIONS and tu in _GRAM_CONVERSIONS:
        return quantity * _GRAM_CONVERSIONS[fu] / _GRAM_CONVERSIONS[tu]
    # Volume conversions
    if fu in _ML_CONVERSIONS and tu in _ML_CONVERSIONS:
        return quantity * _ML_CONVERSIONS[fu] / _ML_CONVERSIONS[tu]
    # Incompatible units — return as-is (best effort)
    return quantity


# ---------------------------------------------------------------------------
# Pure function: recipe nutritional aggregation
# ---------------------------------------------------------------------------


def aggregate_recipe_nutrition(
    ingredients: list[RecipeIngredient],
) -> RecipeNutrition:
    """Compute total nutritional values for a recipe from its ingredients.

    For each ingredient, scale its per-serving nutritional values by
    (quantity_in_serving_unit / serving_size), then sum across all ingredients.

    This is a pure function with no side effects.
    """
    total_calories = 0.0
    total_protein = 0.0
    total_carbs = 0.0
    total_fat = 0.0
    total_micros: dict[str, float] = {}

    for ing in ingredients:
        food = ing.food_item
        if food is None:
            continue

        quantity = _convert_unit(ing.quantity, ing.unit, food.serving_unit)
        scale = quantity / food.serving_size if food.serving_size > 0 else 0.0

        total_calories += food.calories * scale
        total_protein += food.protein_g * scale
        total_carbs += food.carbs_g * scale
        total_fat += food.fat_g * scale

        # Aggregate micro-nutrients
        if food.micro_nutrients:
            for key, value in food.micro_nutrients.items():
                if isinstance(value, (int, float)):
                    total_micros[key] = total_micros.get(key, 0.0) + value * scale

    return RecipeNutrition(
        total_calories=total_calories,
        total_protein_g=total_protein,
        total_carbs_g=total_carbs,
        total_fat_g=total_fat,
        total_micro_nutrients=total_micros,
    )
