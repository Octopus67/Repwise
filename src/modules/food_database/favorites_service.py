"""Favorites sub-service — toggle favorites and retrieve favorite food items."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.food_database.models import FoodItem


class FavoritesService:
    """Handles user food favorites and frequency tracking."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def toggle_favorite(self, user_id: uuid.UUID, food_item_id: uuid.UUID) -> bool:
        """Toggle is_favorite on a UserFoodFrequency row. Creates row if missing. Returns new state."""
        from src.modules.food_database.models import UserFoodFrequency

        stmt = select(UserFoodFrequency).where(
            UserFoodFrequency.user_id == user_id,
            UserFoodFrequency.food_item_id == food_item_id,
        ).with_for_update()
        result = await self.db.execute(stmt)
        freq = result.scalar_one_or_none()
        if freq is None:
            freq = UserFoodFrequency(user_id=user_id, food_item_id=food_item_id, is_favorite=True)
            self.db.add(freq)
        else:
            freq.is_favorite = not freq.is_favorite
        await self.db.flush()
        return freq.is_favorite

    async def get_favorites(self, user_id: uuid.UUID, limit: int = 10) -> list[Any]:
        """Return favorite food items ordered by log_count desc."""
        from src.modules.food_database.models import UserFoodFrequency

        stmt = (
            select(FoodItem)
            .join(UserFoodFrequency, UserFoodFrequency.food_item_id == FoodItem.id)
            .where(UserFoodFrequency.user_id == user_id, UserFoodFrequency.is_favorite.is_(True))
            .order_by(UserFoodFrequency.log_count.desc())
            .limit(limit)
        )
        stmt = FoodItem.not_deleted(stmt)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
