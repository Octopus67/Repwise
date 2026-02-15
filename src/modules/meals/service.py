"""Meal library service — custom meals and favorites CRUD + pre-fill logic."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.meals.models import CustomMeal, MealFavorite
from src.modules.meals.schemas import (
    CustomMealCreate,
    CustomMealUpdate,
    MealFavoriteCreate,
    NutritionEntryPreFill,
)
from src.shared.errors import NotFoundError
from src.shared.pagination import PaginatedResult, PaginationParams
from src.shared.types import MealSourceType


class MealService:
    """Manages custom meals and meal favorites for a user."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Custom Meals
    # ------------------------------------------------------------------

    async def create_custom_meal(
        self, user_id: uuid.UUID, data: CustomMealCreate
    ) -> CustomMeal:
        """Create a new custom meal for the user."""
        meal = CustomMeal(
            user_id=user_id,
            name=data.name,
            calories=data.calories,
            protein_g=data.protein_g,
            carbs_g=data.carbs_g,
            fat_g=data.fat_g,
            micro_nutrients=data.micro_nutrients,
            source_type=MealSourceType.CUSTOM,
        )
        self.db.add(meal)
        await self.db.flush()
        await self.db.refresh(meal)
        return meal

    async def update_custom_meal(
        self,
        user_id: uuid.UUID,
        meal_id: uuid.UUID,
        data: CustomMealUpdate,
    ) -> CustomMeal:
        """Update an existing custom meal.

        Only updates the meal *definition* — previously logged nutrition
        entries that referenced this meal are not altered (Req 4.5).
        """
        meal = await self._get_custom_meal_or_raise(user_id, meal_id)

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(meal, field, value)

        await self.db.flush()
        await self.db.refresh(meal)
        return meal

    async def delete_custom_meal(
        self, user_id: uuid.UUID, meal_id: uuid.UUID
    ) -> None:
        """Soft-delete a custom meal."""
        meal = await self._get_custom_meal_or_raise(user_id, meal_id)
        meal.deleted_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def get_custom_meals(
        self, user_id: uuid.UUID, pagination: PaginationParams
    ) -> PaginatedResult[Any]:
        """Return paginated list of the user's custom meals (non-deleted)."""
        base = select(CustomMeal).where(CustomMeal.user_id == user_id)
        base = CustomMeal.not_deleted(base)

        # Total count
        count_stmt = select(func.count()).select_from(base.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        # Paginated items
        items_stmt = (
            base.order_by(CustomMeal.created_at.desc())
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

    # ------------------------------------------------------------------
    # Favorites
    # ------------------------------------------------------------------

    async def add_favorite(
        self, user_id: uuid.UUID, data: MealFavoriteCreate
    ) -> MealFavorite:
        """Add a meal (custom or food-database item) to the user's favorites."""
        favorite = MealFavorite(
            user_id=user_id,
            meal_id=data.meal_id,
            food_item_id=data.food_item_id,
            name=data.name,
            calories=data.calories,
            protein_g=data.protein_g,
            carbs_g=data.carbs_g,
            fat_g=data.fat_g,
            micro_nutrients=data.micro_nutrients,
        )
        self.db.add(favorite)
        await self.db.flush()
        await self.db.refresh(favorite)
        return favorite

    async def remove_favorite(
        self, user_id: uuid.UUID, favorite_id: uuid.UUID
    ) -> None:
        """Remove a meal from the user's favorites (hard delete)."""
        stmt = select(MealFavorite).where(
            MealFavorite.id == favorite_id,
            MealFavorite.user_id == user_id,
        )
        result = await self.db.execute(stmt)
        favorite = result.scalar_one_or_none()
        if favorite is None:
            raise NotFoundError("Favorite not found")
        await self.db.delete(favorite)
        await self.db.flush()

    async def get_favorites(
        self, user_id: uuid.UUID, pagination: PaginationParams
    ) -> PaginatedResult[Any]:
        """Return paginated list of the user's meal favorites."""
        base = select(MealFavorite).where(MealFavorite.user_id == user_id)

        count_stmt = select(func.count()).select_from(base.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        items_stmt = (
            base.order_by(MealFavorite.created_at.desc())
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

    # ------------------------------------------------------------------
    # Pre-fill logic
    # ------------------------------------------------------------------

    async def prefill_from_custom_meal(
        self, user_id: uuid.UUID, meal_id: uuid.UUID
    ) -> NutritionEntryPreFill:
        """Convert a custom meal into a NutritionEntryCreate-compatible dict.

        The returned object can be used directly to pre-fill a nutrition
        entry form (Req 4.4).
        """
        meal = await self._get_custom_meal_or_raise(user_id, meal_id)
        return NutritionEntryPreFill(
            meal_name=meal.name,
            calories=meal.calories,
            protein_g=meal.protein_g,
            carbs_g=meal.carbs_g,
            fat_g=meal.fat_g,
            micro_nutrients=meal.micro_nutrients,
            source_meal_id=meal.id,
        )

    async def prefill_from_favorite(
        self, user_id: uuid.UUID, favorite_id: uuid.UUID
    ) -> NutritionEntryPreFill:
        """Convert a favorite into a NutritionEntryCreate-compatible dict."""
        stmt = select(MealFavorite).where(
            MealFavorite.id == favorite_id,
            MealFavorite.user_id == user_id,
        )
        result = await self.db.execute(stmt)
        favorite = result.scalar_one_or_none()
        if favorite is None:
            raise NotFoundError("Favorite not found")

        return NutritionEntryPreFill(
            meal_name=favorite.name,
            calories=favorite.calories,
            protein_g=favorite.protein_g,
            carbs_g=favorite.carbs_g,
            fat_g=favorite.fat_g,
            micro_nutrients=favorite.micro_nutrients,
            source_meal_id=favorite.meal_id,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_custom_meal_or_raise(
        self, user_id: uuid.UUID, meal_id: uuid.UUID
    ) -> CustomMeal:
        """Fetch a non-deleted custom meal owned by the user, or 404."""
        stmt = select(CustomMeal).where(
            CustomMeal.id == meal_id,
            CustomMeal.user_id == user_id,
        )
        stmt = CustomMeal.not_deleted(stmt)
        result = await self.db.execute(stmt)
        meal = result.scalar_one_or_none()
        if meal is None:
            raise NotFoundError("Custom meal not found")
        return meal
