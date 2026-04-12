"""Phase 2.1: Food frequency tracking tests (5 tests).

Validates: food_item_id tracking, frequency increments, search ranking,
graceful handling without food_item_id, and last_logged_at updates.
"""

from __future__ import annotations

import uuid
from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.auth.models import User
from src.modules.food_database.models import FoodItem, UserFoodFrequency
from src.modules.nutrition.schemas import NutritionEntryCreate
from src.modules.nutrition.service import NutritionService
from src.modules.food_database.service import FoodDatabaseService
from src.shared.pagination import PaginationParams


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_user(db: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"freq-{uuid.uuid4().hex[:8]}@test.com",
        auth_provider="email",
        auth_provider_id="",
        role="user",
        hashed_password="fakehash",
    )
    db.add(user)
    await db.flush()
    return user


async def _create_food_item(db: AsyncSession, name: str = "Chicken Breast") -> FoodItem:
    item = FoodItem(
        id=uuid.uuid4(),
        name=name,
        category="Protein",
        region="IN",
        serving_size=100.0,
        serving_unit="g",
        calories=165.0,
        protein_g=31.0,
        carbs_g=0.0,
        fat_g=3.6,
        source="usda",
    )
    db.add(item)
    await db.flush()
    return item


def _entry(
    food_item_id: uuid.UUID | None = None, food_name: str = "Chicken"
) -> NutritionEntryCreate:
    return NutritionEntryCreate(
        meal_name="Lunch",
        food_name=food_name,
        calories=165.0,
        protein_g=31.0,
        carbs_g=0.0,
        fat_g=3.6,
        entry_date=date.today(),
        food_item_id=food_item_id,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestFoodFrequencyTracking:
    @pytest.mark.asyncio
    async def test_food_item_id_included_in_post(self, db_session: AsyncSession):
        """Logging with food_item_id creates a UserFoodFrequency record."""
        user = await _create_user(db_session)
        food = await _create_food_item(db_session)
        svc = NutritionService(db_session)

        await svc.create_entry(user.id, _entry(food_item_id=food.id))
        await db_session.commit()

        stmt = select(UserFoodFrequency).where(
            UserFoodFrequency.user_id == user.id,
            UserFoodFrequency.food_item_id == food.id,
        )
        freq = (await db_session.execute(stmt)).scalar_one_or_none()
        assert freq is not None
        assert freq.log_count >= 1

    @pytest.mark.asyncio
    async def test_frequency_increments_on_log(self, db_session: AsyncSession):
        """Logging the same food 3 times yields log_count == 3."""
        user = await _create_user(db_session)
        food = await _create_food_item(db_session)
        svc = NutritionService(db_session)

        for _ in range(3):
            await svc.create_entry(user.id, _entry(food_item_id=food.id))
            await db_session.commit()

        stmt = select(UserFoodFrequency).where(
            UserFoodFrequency.user_id == user.id,
            UserFoodFrequency.food_item_id == food.id,
        )
        freq = (await db_session.execute(stmt)).scalar_one()
        assert freq.log_count == 3

    @pytest.mark.asyncio
    async def test_frequency_affects_search_ranking(self, db_session: AsyncSession):
        """Food logged 10× ranks higher than food logged 1× in search."""
        user = await _create_user(db_session)
        food_a = await _create_food_item(db_session, name="Alpha Rice")
        food_b = await _create_food_item(db_session, name="Alpha Bread")
        svc = NutritionService(db_session)

        # Log food_a 10 times, food_b 1 time
        for _ in range(10):
            await svc.create_entry(user.id, _entry(food_item_id=food_a.id, food_name="Alpha Rice"))
            await db_session.commit()
        await svc.create_entry(user.id, _entry(food_item_id=food_b.id, food_name="Alpha Bread"))
        await db_session.commit()

        food_svc = FoodDatabaseService(db_session)
        result = await food_svc.search(
            query="Alpha",
            pagination=PaginationParams(page=1, limit=10),
            user_id=user.id,
        )

        ids = [item.id for item in result.items]
        assert food_a.id in ids and food_b.id in ids
        assert ids.index(food_a.id) < ids.index(food_b.id)

    @pytest.mark.asyncio
    async def test_frequency_tracking_without_food_item_id(self, db_session: AsyncSession):
        """Logging without food_item_id creates no frequency record."""
        user = await _create_user(db_session)
        svc = NutritionService(db_session)

        await svc.create_entry(user.id, _entry(food_item_id=None))
        await db_session.commit()

        stmt = select(UserFoodFrequency).where(UserFoodFrequency.user_id == user.id)
        result = (await db_session.execute(stmt)).scalars().all()
        assert len(result) == 0

    @pytest.mark.asyncio
    async def test_frequency_last_logged_at_updates(self, db_session: AsyncSession):
        """last_logged_at updates on subsequent logs."""
        user = await _create_user(db_session)
        food = await _create_food_item(db_session)
        svc = NutritionService(db_session)

        await svc.create_entry(user.id, _entry(food_item_id=food.id))
        await db_session.commit()

        stmt = select(UserFoodFrequency).where(
            UserFoodFrequency.user_id == user.id,
            UserFoodFrequency.food_item_id == food.id,
        )
        freq1 = (await db_session.execute(stmt)).scalar_one()
        ts1 = freq1.last_logged_at

        # Log again
        await svc.create_entry(user.id, _entry(food_item_id=food.id))
        await db_session.commit()

        await db_session.refresh(freq1)
        ts2 = freq1.last_logged_at

        assert ts1 is not None
        assert ts2 is not None
        assert ts2 >= ts1
