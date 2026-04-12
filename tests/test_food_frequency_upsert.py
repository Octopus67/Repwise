"""Unit tests for UserFoodFrequency upsert logic in NutritionService.create_entry.

Tests: first log creates entry, subsequent logs increment, no breakage without food_item_id.
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


# ── Helpers ──


async def _create_user(db: AsyncSession) -> User:
    user = User(
        email=f"test-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="hashed",
        auth_provider="email",
        role="user",
    )
    db.add(user)
    await db.flush()
    return user


async def _create_food_item(db: AsyncSession) -> FoodItem:
    item = FoodItem(
        name="Chicken Breast",
        category="protein",
        region="US",
        calories=165,
        protein_g=31,
        carbs_g=0,
        fat_g=3.6,
        source="usda",
    )
    db.add(item)
    await db.flush()
    return item


# ── Tests ──


class TestFoodFrequencyUpsert:
    @pytest.mark.asyncio
    async def test_first_log_creates_frequency_entry(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        food = await _create_food_item(db_session)
        svc = NutritionService(db_session)

        entry_data = NutritionEntryCreate(
            meal_name="Lunch",
            calories=165,
            protein_g=31,
            carbs_g=0,
            fat_g=3.6,
            entry_date=date.today(),
            food_item_id=food.id,
        )
        await svc.create_entry(user.id, entry_data)

        stmt = select(UserFoodFrequency).where(
            UserFoodFrequency.user_id == user.id,
            UserFoodFrequency.food_item_id == food.id,
        )
        freq = (await db_session.execute(stmt)).scalar_one_or_none()
        assert freq is not None
        assert freq.log_count == 1
        assert freq.last_logged_at is not None

    @pytest.mark.asyncio
    async def test_second_log_increments_count(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        food = await _create_food_item(db_session)
        svc = NutritionService(db_session)

        entry_data = NutritionEntryCreate(
            meal_name="Lunch",
            calories=165,
            protein_g=31,
            carbs_g=0,
            fat_g=3.6,
            entry_date=date.today(),
            food_item_id=food.id,
        )
        await svc.create_entry(user.id, entry_data)
        await svc.create_entry(user.id, entry_data)

        stmt = select(UserFoodFrequency).where(
            UserFoodFrequency.user_id == user.id,
            UserFoodFrequency.food_item_id == food.id,
        )
        freq = (await db_session.execute(stmt)).scalar_one()
        assert freq.log_count == 2

    @pytest.mark.asyncio
    async def test_third_log_increments_to_three(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        food = await _create_food_item(db_session)
        svc = NutritionService(db_session)

        entry_data = NutritionEntryCreate(
            meal_name="Dinner",
            calories=165,
            protein_g=31,
            carbs_g=0,
            fat_g=3.6,
            entry_date=date.today(),
            food_item_id=food.id,
        )
        for _ in range(3):
            await svc.create_entry(user.id, entry_data)

        stmt = select(UserFoodFrequency).where(
            UserFoodFrequency.user_id == user.id,
            UserFoodFrequency.food_item_id == food.id,
        )
        freq = (await db_session.execute(stmt)).scalar_one()
        assert freq.log_count == 3

    @pytest.mark.asyncio
    async def test_no_food_item_id_skips_frequency(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        svc = NutritionService(db_session)

        entry_data = NutritionEntryCreate(
            meal_name="Quick entry",
            calories=200,
            protein_g=10,
            carbs_g=30,
            fat_g=5,
            entry_date=date.today(),
        )
        entry = await svc.create_entry(user.id, entry_data)
        assert entry is not None

        # No frequency entry should exist
        stmt = select(UserFoodFrequency).where(UserFoodFrequency.user_id == user.id)
        result = (await db_session.execute(stmt)).scalars().all()
        assert len(result) == 0

    @pytest.mark.asyncio
    async def test_different_foods_tracked_separately(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        food1 = await _create_food_item(db_session)
        food2 = FoodItem(
            name="Brown Rice",
            category="grain",
            region="US",
            calories=216,
            protein_g=5,
            carbs_g=45,
            fat_g=1.8,
            source="usda",
        )
        db_session.add(food2)
        await db_session.flush()

        svc = NutritionService(db_session)

        for food, count in [(food1, 3), (food2, 1)]:
            for _ in range(count):
                await svc.create_entry(
                    user.id,
                    NutritionEntryCreate(
                        meal_name="Meal",
                        calories=100,
                        protein_g=10,
                        carbs_g=10,
                        fat_g=5,
                        entry_date=date.today(),
                        food_item_id=food.id,
                    ),
                )

        stmt = select(UserFoodFrequency).where(UserFoodFrequency.user_id == user.id)
        freqs = {
            f.food_item_id: f.log_count for f in (await db_session.execute(stmt)).scalars().all()
        }
        assert freqs[food1.id] == 3
        assert freqs[food2.id] == 1

    @pytest.mark.asyncio
    async def test_entry_still_created_even_if_frequency_fails(self, db_session: AsyncSession):
        """Frequency tracking failure must not break nutrition entry creation."""
        user = await _create_user(db_session)
        svc = NutritionService(db_session)

        # Use a non-existent food_item_id — FK constraint will fail on frequency insert
        # but the entry itself should still be created (wrapped in try/except)
        fake_food_id = uuid.uuid4()
        entry_data = NutritionEntryCreate(
            meal_name="Test",
            calories=100,
            protein_g=10,
            carbs_g=10,
            fat_g=5,
            entry_date=date.today(),
            food_item_id=fake_food_id,
        )
        # This should not raise — frequency failure is caught
        entry = await svc.create_entry(user.id, entry_data)
        assert entry is not None
        assert entry.calories == 100

    @pytest.mark.asyncio
    async def test_last_logged_at_updates_on_subsequent_logs(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        food = await _create_food_item(db_session)
        svc = NutritionService(db_session)

        entry_data = NutritionEntryCreate(
            meal_name="Lunch",
            calories=165,
            protein_g=31,
            carbs_g=0,
            fat_g=3.6,
            entry_date=date.today(),
            food_item_id=food.id,
        )
        await svc.create_entry(user.id, entry_data)

        stmt = select(UserFoodFrequency).where(
            UserFoodFrequency.user_id == user.id,
            UserFoodFrequency.food_item_id == food.id,
        )
        freq1 = (await db_session.execute(stmt)).scalar_one()
        first_logged = freq1.last_logged_at

        await svc.create_entry(user.id, entry_data)
        await db_session.refresh(freq1)
        assert freq1.last_logged_at >= first_logged
