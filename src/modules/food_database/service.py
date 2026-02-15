"""Food database service — search, CRUD, and recipe nutritional aggregation."""

from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.modules.food_database.models import FoodItem, RecipeIngredient
from src.modules.food_database.schemas import (
    FoodItemCreate,
    FoodItemUpdate,
    RecipeCreateRequest,
    RecipeDetailResponse,
    RecipeIngredientInput,
    RecipeIngredientResponse,
    RecipeNutrition,
    RecipeUpdateRequest,
    FoodItemResponse,
)
from src.shared.errors import ForbiddenError, NotFoundError, ValidationError
from src.shared.pagination import PaginatedResult, PaginationParams

logger = logging.getLogger(__name__)


class FoodDatabaseService:
    """Manages food items, recipes, and nutritional data."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    async def search(
        self,
        query: str,
        pagination: PaginationParams,
        category: Optional[str] = None,
        region: Optional[str] = None,
        user_prefs: Optional[dict] = None,
    ) -> PaginatedResult[Any]:
        """Search food items by name (case-insensitive LIKE).

        Uses ILIKE for SQLite/PostgreSQL compatibility in tests.
        All food data is pre-seeded locally — no external API calls needed.
        """
        base = select(FoodItem)
        base = FoodItem.not_deleted(base)

        # Text search on name — prefix match first, then contains match.
        if query:
            base = base.where(func.lower(FoodItem.name).like(func.lower(f"%{query}%")))

        # Optional filters
        if category:
            base = base.where(FoodItem.category == category)
        if region:
            base = base.where(FoodItem.region == region)

        # Skip expensive count for search queries on large tables
        # The frontend doesn't need exact total for typeahead results
        total = -1
        if not query:
            count_stmt = select(func.count()).select_from(base.subquery())
            total = (await self.db.execute(count_stmt)).scalar_one()

        # For search queries, prioritize simpler/shorter names (e.g. "Cheese" before
        # "CHEESE & ARTISAN CRACKERS"). Exact matches first, then by name length.
        if query:
            # Relevance: exact match → short prefix match → longer prefix → contains match
            relevance = case(
                (func.lower(FoodItem.name) == func.lower(query), 0),  # exact match
                (func.lower(FoodItem.name).like(func.lower(f"{query}%")), 1),  # prefix match (starts with query)
                else_=2,  # contains match
            )
            # Within same relevance tier, prefer shorter names (simpler foods)
            source_priority = case(
                (FoodItem.source == "usda", 0),
                (FoodItem.source == "verified", 1),
                (FoodItem.source == "community", 2),
                (FoodItem.source == "custom", 3),
                else_=4,
            )
            items_stmt = (
                base.order_by(relevance, source_priority, func.length(FoodItem.name), FoodItem.name)
                .offset(pagination.offset)
                .limit(pagination.limit)
            )
        else:
            source_priority = case(
                (FoodItem.source == "usda", 0),
                (FoodItem.source == "verified", 1),
                (FoodItem.source == "community", 2),
                (FoodItem.source == "custom", 3),
                else_=4,
            )
            items_stmt = (
                base.order_by(source_priority, FoodItem.name)
                .offset(pagination.offset)
                .limit(pagination.limit)
            )
        result = await self.db.execute(items_stmt)
        items = list(result.scalars().all())

        # Apply Food DNA personalization
        if user_prefs:
            items = self._personalize_results(items, user_prefs)

        return PaginatedResult(
            items=items,
            total_count=total,
            page=pagination.page,
            limit=pagination.limit,
        )

    # ------------------------------------------------------------------
    # Food DNA personalization
    # ------------------------------------------------------------------

    @staticmethod
    def _personalize_results(
        items: list[Any],
        user_prefs: Optional[dict],
    ) -> list[Any]:
        """Re-rank search results based on user's Food DNA preferences.
        
        Boost factors (multiplicative):
          +50% if food.region matches any cuisine_preferences
          +30% if food.source == 'verified'
          +20% if food.source == 'usda'
          -80% if food name contains an allergen keyword
          -50% if food category conflicts with dietary restrictions
        """
        if not user_prefs or not items:
            return items

        cuisine_prefs = {c.lower() for c in (user_prefs.get("cuisine_preferences") or [])}
        restrictions = {r.lower() for r in (user_prefs.get("dietary_restrictions") or [])}
        allergies = {a.lower() for a in (user_prefs.get("allergies") or [])}

        if not cuisine_prefs and not restrictions and not allergies:
            return items

        scored: list[tuple[float, Any]] = []
        for item in items:
            score = 1.0

            # Boost matching cuisines
            region = getattr(item, "region", "") or ""
            if cuisine_prefs and region.lower() in cuisine_prefs:
                score *= 1.5

            # Boost verified/usda sources
            source = getattr(item, "source", "") or ""
            if source == "verified":
                score *= 1.3
            elif source == "usda":
                score *= 1.2

            # Demote allergens
            name_lower = (getattr(item, "name", "") or "").lower()
            for allergen in allergies:
                if allergen in name_lower:
                    score *= 0.2
                    break

            # Demote restricted foods
            cat_lower = (getattr(item, "category", "") or "").lower()
            if restrictions:
                meat_categories = {"meat", "poultry", "seafood", "protein"}
                if "vegetarian" in restrictions and cat_lower in meat_categories:
                    score *= 0.5
                if "vegan" in restrictions and cat_lower in (meat_categories | {"dairy"}):
                    score *= 0.3

            scored.append((score, item))

        scored.sort(key=lambda x: -x[0])
        return [item for _, item in scored]

    # ------------------------------------------------------------------
    # Get by ID
    # ------------------------------------------------------------------

    async def get_by_id(self, food_item_id: uuid.UUID) -> FoodItem:
        """Retrieve a single food item by ID."""
        stmt = select(FoodItem).where(FoodItem.id == food_item_id)
        stmt = FoodItem.not_deleted(stmt)
        result = await self.db.execute(stmt)
        item = result.scalar_one_or_none()
        if item is None:
            raise NotFoundError("Food item not found")
        return item

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
        ingredient_rows: list[RecipeIngredient] = []
        for ing in ingredients:
            if ing.food_item_id == recipe.id:
                raise ValidationError("A recipe cannot contain itself as an ingredient")

            # Verify ingredient exists and is not deleted
            stmt = select(FoodItem).where(FoodItem.id == ing.food_item_id)
            stmt = FoodItem.not_deleted(stmt)
            result = await self.db.execute(stmt)
            food = result.scalar_one_or_none()
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
            existing_stmt = select(RecipeIngredient).where(
                RecipeIngredient.recipe_id == recipe_id
            )
            existing_result = await self.db.execute(existing_stmt)
            for old_ing in existing_result.scalars().all():
                await self.db.delete(old_ing)
            await self.db.flush()

            # Create new ingredient rows
            for ing in ingredients:
                if ing.food_item_id == recipe_id:
                    raise ValidationError("A recipe cannot contain itself as an ingredient")

                food_stmt = select(FoodItem).where(FoodItem.id == ing.food_item_id)
                food_stmt = FoodItem.not_deleted(food_stmt)
                food_result = await self.db.execute(food_stmt)
                food = food_result.scalar_one_or_none()
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

    async def get_recipe(self, recipe_id: uuid.UUID) -> RecipeDetailResponse:
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

        # Aggregate nutrition from ingredients
        nutrition = aggregate_recipe_nutrition(recipe.ingredients)

        ingredient_responses = [
            RecipeIngredientResponse(
                id=ing.id,
                recipe_id=ing.recipe_id,
                food_item_id=ing.food_item_id,
                quantity=ing.quantity,
                unit=ing.unit,
                food_item=FoodItemResponse.model_validate(ing.food_item) if ing.food_item else None,
            )
            for ing in recipe.ingredients
        ]

        return RecipeDetailResponse(
            recipe=FoodItemResponse.model_validate(recipe),
            ingredients=ingredient_responses,
            nutrition=nutrition,
        )

    # ------------------------------------------------------------------
    # Admin CRUD
    # ------------------------------------------------------------------

    async def create_food_item(self, data: FoodItemCreate) -> FoodItem:
        """Create a new food item (admin only)."""
        item = FoodItem(
            name=data.name,
            category=data.category,
            region=data.region,
            serving_size=data.serving_size,
            serving_unit=data.serving_unit,
            calories=data.calories,
            protein_g=data.protein_g,
            carbs_g=data.carbs_g,
            fat_g=data.fat_g,
            micro_nutrients=data.micro_nutrients,
            is_recipe=data.is_recipe,
            source="custom",  # Server-enforced: always "custom" for user-created items
            barcode=data.barcode,
            description=data.description,
            total_servings=data.total_servings,
        )
        self.db.add(item)
        await self.db.flush()
        await self.db.refresh(item)
        return item

    async def update_food_item(
        self, food_item_id: uuid.UUID, data: FoodItemUpdate
    ) -> FoodItem:
        """Update an existing food item (admin only)."""
        item = await self.get_by_id(food_item_id)
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(item, field, value)
        await self.db.flush()
        await self.db.refresh(item)
        return item


# ---------------------------------------------------------------------------
# Pure function: recipe nutritional aggregation
# ---------------------------------------------------------------------------


def aggregate_recipe_nutrition(
    ingredients: list[RecipeIngredient],
) -> RecipeNutrition:
    """Compute total nutritional values for a recipe from its ingredients.

    For each ingredient, scale its per-serving nutritional values by
    (quantity / serving_size), then sum across all ingredients.

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

        scale = ing.quantity / food.serving_size if food.serving_size > 0 else 0.0

        total_calories += food.calories * scale
        total_protein += food.protein_g * scale
        total_carbs += food.carbs_g * scale
        total_fat += food.fat_g * scale

        # Aggregate micro-nutrients
        if food.micro_nutrients:
            for key, value in food.micro_nutrients.items():
                total_micros[key] = total_micros.get(key, 0.0) + value * scale

    return RecipeNutrition(
        total_calories=total_calories,
        total_protein_g=total_protein,
        total_carbs_g=total_carbs,
        total_fat_g=total_fat,
        total_micro_nutrients=total_micros,
    )
