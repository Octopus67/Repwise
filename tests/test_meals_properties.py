"""Property-based tests for the meal library module.

Tests Properties 8, 23, and 28 from the design document using Hypothesis.
Operates at the service level using the db_session fixture.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.meals.schemas import (
    CustomMealCreate,
    CustomMealUpdate,
    MealFavoriteCreate,
)
from src.modules.meals.service import MealService
from src.modules.nutrition.service import NutritionService
from src.modules.nutrition.schemas import NutritionEntryCreate
from src.modules.auth.models import User
from src.shared.pagination import PaginationParams


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_meal_names = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "Zs"), min_codepoint=32, max_codepoint=127),
    min_size=1,
    max_size=100,
).filter(lambda s: s.strip() != "")

_positive_floats = st.floats(min_value=0.0, max_value=5000.0, allow_nan=False, allow_infinity=False)

_micro_nutrients = st.one_of(
    st.none(),
    st.dictionaries(
        keys=st.sampled_from(["fiber", "sodium", "iron", "calcium", "vitamin_d", "vitamin_b12"]),
        values=st.floats(min_value=0.0, max_value=1000.0, allow_nan=False, allow_infinity=False),
        min_size=0,
        max_size=4,
    ),
)


@st.composite
def custom_meal_create_strategy(draw):
    """Generate a valid CustomMealCreate payload."""
    return CustomMealCreate(
        name=draw(_meal_names),
        calories=draw(_positive_floats),
        protein_g=draw(_positive_floats),
        carbs_g=draw(_positive_floats),
        fat_g=draw(_positive_floats),
        micro_nutrients=draw(_micro_nutrients),
    )


@st.composite
def custom_meal_update_strategy(draw):
    """Generate a CustomMealUpdate with at least one field set."""
    fields = {}
    if draw(st.booleans()):
        fields["name"] = draw(_meal_names)
    if draw(st.booleans()):
        fields["calories"] = draw(_positive_floats)
    if draw(st.booleans()):
        fields["protein_g"] = draw(_positive_floats)
    if draw(st.booleans()):
        fields["carbs_g"] = draw(_positive_floats)
    if draw(st.booleans()):
        fields["fat_g"] = draw(_positive_floats)
    if draw(st.booleans()):
        fields["micro_nutrients"] = draw(_micro_nutrients)
    # Ensure at least one field is set
    if not fields:
        fields["name"] = draw(_meal_names)
    return CustomMealUpdate(**fields)


# ---------------------------------------------------------------------------
# Shared Hypothesis settings
# ---------------------------------------------------------------------------

_fixture_settings = h_settings(
    max_examples=50,
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
# Property 8: Favorites round-trip
# ---------------------------------------------------------------------------


class TestProperty8FavoritesRoundTrip:
    """Property 8: Favorites round-trip.

    Add random meals to favorites, verify they appear in favorites list;
    remove and verify exclusion.

    **Validates: Requirements 4.2**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=custom_meal_create_strategy())
    async def test_add_favorite_appears_in_list(
        self, data: CustomMealCreate, db_session: AsyncSession
    ):
        """Adding a meal to favorites makes it appear in the favorites list.

        **Validates: Requirements 4.2**
        """
        user = await _create_test_user(db_session)
        service = MealService(db_session)

        # Create a custom meal first
        meal = await service.create_custom_meal(user.id, data)

        # Add it to favorites
        fav_data = MealFavoriteCreate(
            meal_id=meal.id,
            name=meal.name,
            calories=meal.calories,
            protein_g=meal.protein_g,
            carbs_g=meal.carbs_g,
            fat_g=meal.fat_g,
            micro_nutrients=meal.micro_nutrients,
        )
        favorite = await service.add_favorite(user.id, fav_data)

        # Verify it appears in the favorites list
        pagination = PaginationParams(page=1, limit=100)
        result = await service.get_favorites(user.id, pagination)
        fav_ids = [f.id for f in result.items]
        assert favorite.id in fav_ids, "Favorite should appear in favorites list"

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=custom_meal_create_strategy())
    async def test_remove_favorite_excludes_from_list(
        self, data: CustomMealCreate, db_session: AsyncSession
    ):
        """Removing a favorite excludes it from the favorites list.

        **Validates: Requirements 4.2**
        """
        user = await _create_test_user(db_session)
        service = MealService(db_session)

        # Create a custom meal and add to favorites
        meal = await service.create_custom_meal(user.id, data)
        fav_data = MealFavoriteCreate(
            meal_id=meal.id,
            name=meal.name,
            calories=meal.calories,
            protein_g=meal.protein_g,
            carbs_g=meal.carbs_g,
            fat_g=meal.fat_g,
            micro_nutrients=meal.micro_nutrients,
        )
        favorite = await service.add_favorite(user.id, fav_data)

        # Remove the favorite
        await service.remove_favorite(user.id, favorite.id)

        # Verify it no longer appears
        pagination = PaginationParams(page=1, limit=100)
        result = await service.get_favorites(user.id, pagination)
        fav_ids = [f.id for f in result.items]
        assert favorite.id not in fav_ids, "Removed favorite should not appear in list"

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        meals=st.lists(custom_meal_create_strategy(), min_size=1, max_size=5),
    )
    async def test_multiple_favorites_all_appear(
        self, meals: list[CustomMealCreate], db_session: AsyncSession
    ):
        """Adding N meals to favorites results in all N appearing in the list.

        **Validates: Requirements 4.2**
        """
        user = await _create_test_user(db_session)
        service = MealService(db_session)

        fav_ids = []
        for meal_data in meals:
            meal = await service.create_custom_meal(user.id, meal_data)
            fav_data = MealFavoriteCreate(
                meal_id=meal.id,
                name=meal.name,
                calories=meal.calories,
                protein_g=meal.protein_g,
                carbs_g=meal.carbs_g,
                fat_g=meal.fat_g,
                micro_nutrients=meal.micro_nutrients,
            )
            fav = await service.add_favorite(user.id, fav_data)
            fav_ids.append(fav.id)

        pagination = PaginationParams(page=1, limit=100)
        result = await service.get_favorites(user.id, pagination)
        listed_ids = {f.id for f in result.items}

        for fid in fav_ids:
            assert fid in listed_ids, f"Favorite {fid} should appear in list"


# ---------------------------------------------------------------------------
# Property 23: Custom meal edit isolation
# ---------------------------------------------------------------------------


class TestProperty23CustomMealEditIsolation:
    """Property 23: Custom meal edit isolation.

    Create a custom meal, log entries from it (via prefill), edit the meal,
    verify logged entries are unchanged.

    **Validates: Requirements 4.5, 4.3**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        meal_data=custom_meal_create_strategy(),
        update_data=custom_meal_update_strategy(),
    )
    async def test_edit_meal_does_not_alter_logged_entries(
        self,
        meal_data: CustomMealCreate,
        update_data: CustomMealUpdate,
        db_session: AsyncSession,
    ):
        """Editing a custom meal definition does not change previously logged entries.

        **Validates: Requirements 4.5, 4.3**
        """
        user = await _create_test_user(db_session)
        meal_service = MealService(db_session)
        nutrition_service = NutritionService(db_session)

        # 1. Create a custom meal
        meal = await meal_service.create_custom_meal(user.id, meal_data)

        # 2. Get pre-fill data and log a nutrition entry from it
        prefill = await meal_service.prefill_from_custom_meal(user.id, meal.id)
        entry_create = NutritionEntryCreate(
            meal_name=prefill.meal_name,
            calories=prefill.calories,
            protein_g=prefill.protein_g,
            carbs_g=prefill.carbs_g,
            fat_g=prefill.fat_g,
            micro_nutrients=prefill.micro_nutrients,
            entry_date=date.today(),
            source_meal_id=prefill.source_meal_id,
        )
        entry = await nutrition_service.create_entry(user.id, entry_create)

        # Capture the original entry values
        original_calories = entry.calories
        original_protein = entry.protein_g
        original_carbs = entry.carbs_g
        original_fat = entry.fat_g
        original_name = entry.meal_name

        # 3. Edit the custom meal definition
        await meal_service.update_custom_meal(user.id, meal.id, update_data)

        # 4. Verify the logged entry is unchanged
        await db_session.refresh(entry)
        assert entry.calories == original_calories, "Logged entry calories should not change"
        assert entry.protein_g == original_protein, "Logged entry protein should not change"
        assert entry.carbs_g == original_carbs, "Logged entry carbs should not change"
        assert entry.fat_g == original_fat, "Logged entry fat should not change"
        assert entry.meal_name == original_name, "Logged entry meal_name should not change"


# ---------------------------------------------------------------------------
# Property 28: Meal pre-fill correctness
# ---------------------------------------------------------------------------


class TestProperty28MealPreFillCorrectness:
    """Property 28: Meal pre-fill correctness.

    Select random custom meals, verify pre-filled entry values match
    source meal values.

    **Validates: Requirements 4.4**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=custom_meal_create_strategy())
    async def test_prefill_from_custom_meal_matches_source(
        self, data: CustomMealCreate, db_session: AsyncSession
    ):
        """Pre-filled values from a custom meal must exactly match the source.

        **Validates: Requirements 4.4**
        """
        user = await _create_test_user(db_session)
        service = MealService(db_session)

        meal = await service.create_custom_meal(user.id, data)
        prefill = await service.prefill_from_custom_meal(user.id, meal.id)

        assert prefill.meal_name == meal.name, "Pre-fill meal_name must match source"
        assert prefill.calories == meal.calories, "Pre-fill calories must match source"
        assert prefill.protein_g == meal.protein_g, "Pre-fill protein_g must match source"
        assert prefill.carbs_g == meal.carbs_g, "Pre-fill carbs_g must match source"
        assert prefill.fat_g == meal.fat_g, "Pre-fill fat_g must match source"
        assert prefill.micro_nutrients == meal.micro_nutrients, "Pre-fill micro_nutrients must match source"
        assert prefill.source_meal_id == meal.id, "Pre-fill source_meal_id must reference the meal"

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=custom_meal_create_strategy())
    async def test_prefill_from_favorite_matches_source(
        self, data: CustomMealCreate, db_session: AsyncSession
    ):
        """Pre-filled values from a favorite must match the favorite's snapshot.

        **Validates: Requirements 4.4**
        """
        user = await _create_test_user(db_session)
        service = MealService(db_session)

        # Create meal and add to favorites
        meal = await service.create_custom_meal(user.id, data)
        fav_data = MealFavoriteCreate(
            meal_id=meal.id,
            name=meal.name,
            calories=meal.calories,
            protein_g=meal.protein_g,
            carbs_g=meal.carbs_g,
            fat_g=meal.fat_g,
            micro_nutrients=meal.micro_nutrients,
        )
        favorite = await service.add_favorite(user.id, fav_data)

        prefill = await service.prefill_from_favorite(user.id, favorite.id)

        assert prefill.meal_name == favorite.name, "Pre-fill meal_name must match favorite"
        assert prefill.calories == favorite.calories, "Pre-fill calories must match favorite"
        assert prefill.protein_g == favorite.protein_g, "Pre-fill protein_g must match favorite"
        assert prefill.carbs_g == favorite.carbs_g, "Pre-fill carbs_g must match favorite"
        assert prefill.fat_g == favorite.fat_g, "Pre-fill fat_g must match favorite"
        assert prefill.micro_nutrients == favorite.micro_nutrients, "Pre-fill micro_nutrients must match favorite"
        assert prefill.source_meal_id == favorite.meal_id, "Pre-fill source_meal_id must reference the meal"
