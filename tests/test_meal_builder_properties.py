"""Property-based tests for the Meal Builder feature.

Tests Properties 16 and 17 from the competitive-parity-v1 design document.
Operates at the service level using the db_session fixture.
"""

from __future__ import annotations

import uuid
from datetime import date

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.nutrition.models import NutritionEntry
from src.modules.nutrition.schemas import BatchEntryCreate, BatchEntryItem
from src.modules.nutrition.service import NutritionService
from src.modules.meals.schemas import MealFavoriteCreate
from src.modules.meals.service import MealService
from src.modules.auth.models import User
from src.shared.pagination import PaginationParams


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_reasonable_float = st.floats(
    min_value=0.0, max_value=5000.0, allow_nan=False, allow_infinity=False
)

_meal_names = st.text(
    alphabet=st.characters(
        whitelist_categories=("L", "N", "Zs"), min_codepoint=32, max_codepoint=127
    ),
    min_size=1,
    max_size=100,
).filter(lambda s: s.strip() != "")

_entry_dates = st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 12, 31))


@st.composite
def batch_entry_item_strategy(draw):
    """Generate a valid BatchEntryItem."""
    return BatchEntryItem(
        calories=draw(_reasonable_float),
        protein_g=draw(_reasonable_float),
        carbs_g=draw(_reasonable_float),
        fat_g=draw(_reasonable_float),
    )


@st.composite
def batch_entry_create_strategy(draw):
    """Generate a valid BatchEntryCreate with 1-10 items."""
    items = draw(
        st.lists(batch_entry_item_strategy(), min_size=1, max_size=10)
    )
    return BatchEntryCreate(
        meal_name=draw(_meal_names),
        entry_date=draw(_entry_dates),
        entries=items,
    )


# ---------------------------------------------------------------------------
# Shared settings
# ---------------------------------------------------------------------------

_fixture_settings = h_settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_test_user(db: AsyncSession) -> User:
    """Create a minimal user for testing."""
    user = User(
        id=uuid.uuid4(),
        email=f"test-{uuid.uuid4().hex[:8]}@example.com",
        auth_provider="email",
        auth_provider_id="",
        role="user",
        hashed_password="fakehash",
    )
    db.add(user)
    await db.flush()
    return user


# ---------------------------------------------------------------------------
# Property 16: Meal builder batch save
# ---------------------------------------------------------------------------


class TestProperty16BatchSave:
    """Property 16: Meal builder batch save.

    Batch save creates exactly N entries with same meal_name and entry_date.

    **Validates: Requirements 6.1.6**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=batch_entry_create_strategy())
    async def test_batch_creates_exactly_n_entries(
        self, data: BatchEntryCreate, db_session: AsyncSession
    ):
        """Batch save creates exactly N entries with matching meal_name and entry_date.

        **Validates: Requirements 6.1.6**
        """
        user = await _create_test_user(db_session)
        service = NutritionService(db_session)

        created = await service.create_entries_batch(user_id=user.id, data=data)
        await db_session.commit()

        # Should create exactly N entries
        assert len(created) == len(data.entries)

        # All entries should have the same meal_name and entry_date
        for entry in created:
            assert entry.meal_name == data.meal_name
            assert entry.entry_date == data.entry_date
            assert entry.user_id == user.id

        # Verify via query that exactly N entries exist for this user
        stmt = (
            select(NutritionEntry)
            .where(NutritionEntry.user_id == user.id)
            .where(NutritionEntry.meal_name == data.meal_name)
            .where(NutritionEntry.entry_date == data.entry_date)
        )
        stmt = NutritionEntry.not_deleted(stmt)
        result = await db_session.execute(stmt)
        db_entries = list(result.scalars().all())
        assert len(db_entries) == len(data.entries)

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=batch_entry_create_strategy())
    async def test_batch_entries_have_correct_macros(
        self, data: BatchEntryCreate, db_session: AsyncSession
    ):
        """Each batch entry should have macros matching the input.

        **Validates: Requirements 6.1.6**
        """
        user = await _create_test_user(db_session)
        service = NutritionService(db_session)

        created = await service.create_entries_batch(user_id=user.id, data=data)
        await db_session.commit()

        for i, entry in enumerate(created):
            input_item = data.entries[i]
            assert entry.calories == pytest.approx(input_item.calories)
            assert entry.protein_g == pytest.approx(input_item.protein_g)
            assert entry.carbs_g == pytest.approx(input_item.carbs_g)
            assert entry.fat_g == pytest.approx(input_item.fat_g)


# ---------------------------------------------------------------------------
# Property 17: Favorite meal round-trip
# ---------------------------------------------------------------------------


class TestProperty17FavoriteRoundTrip:
    """Property 17: Favorite meal round-trip.

    Saving a meal as favorite and re-logging produces entries with matching macros.

    **Validates: Requirements 6.1.7**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=batch_entry_create_strategy())
    async def test_save_as_favorite_and_relog_matches_macros(
        self, data: BatchEntryCreate, db_session: AsyncSession
    ):
        """Saving a batch meal as favorite and re-logging produces matching macros.

        **Validates: Requirements 6.1.7**
        """
        user = await _create_test_user(db_session)
        nutrition_service = NutritionService(db_session)
        meal_service = MealService(db_session)

        # 1. Create batch entries (the original meal)
        created = await nutrition_service.create_entries_batch(
            user_id=user.id, data=data
        )
        await db_session.commit()

        # 2. Compute total macros from the batch
        total_calories = sum(e.calories for e in created)
        total_protein = sum(e.protein_g for e in created)
        total_carbs = sum(e.carbs_g for e in created)
        total_fat = sum(e.fat_g for e in created)

        # 3. Save as favorite with total macros
        fav_data = MealFavoriteCreate(
            name=data.meal_name,
            calories=total_calories,
            protein_g=total_protein,
            carbs_g=total_carbs,
            fat_g=total_fat,
        )
        favorite = await meal_service.add_favorite(user.id, fav_data)
        await db_session.commit()

        # 4. Verify favorite has matching macros
        assert favorite.calories == pytest.approx(total_calories)
        assert favorite.protein_g == pytest.approx(total_protein)
        assert favorite.carbs_g == pytest.approx(total_carbs)
        assert favorite.fat_g == pytest.approx(total_fat)
        assert favorite.name == data.meal_name

        # 5. Re-log from favorite (prefill)
        prefill = await meal_service.prefill_from_favorite(user.id, favorite.id)
        assert prefill.calories == pytest.approx(total_calories)
        assert prefill.protein_g == pytest.approx(total_protein)
        assert prefill.carbs_g == pytest.approx(total_carbs)
        assert prefill.fat_g == pytest.approx(total_fat)
