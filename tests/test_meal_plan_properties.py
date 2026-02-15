"""Property-based tests for meal plan CRUD (Properties 11, 12, 13).

Feature: app-fixes-and-nutrition-v2
Validates: Requirements 8.4, 8.7, 8.8
"""

from __future__ import annotations

import uuid
from datetime import date

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.auth.models import User
from src.modules.meals.schemas import CustomMealCreate, CustomMealUpdate
from src.modules.meals.service import MealService
from src.modules.nutrition.schemas import NutritionEntryCreate
from src.modules.nutrition.service import NutritionService
from src.shared.pagination import PaginationParams


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_meal_names = st.text(
    alphabet=st.characters(
        whitelist_categories=("L", "N", "Zs"),
        min_codepoint=32,
        max_codepoint=127,
    ),
    min_size=1,
    max_size=100,
).filter(lambda s: s.strip() != "")

_positive_floats = st.floats(
    min_value=0.0, max_value=5000.0, allow_nan=False, allow_infinity=False
)


@st.composite
def custom_meal_strategy(draw):
    """Generate a valid CustomMealCreate payload."""
    return CustomMealCreate(
        name=draw(_meal_names),
        calories=draw(_positive_floats),
        protein_g=draw(_positive_floats),
        carbs_g=draw(_positive_floats),
        fat_g=draw(_positive_floats),
    )


@st.composite
def custom_meal_update_strategy(draw):
    """Generate a CustomMealUpdate with at least one macro field set."""
    fields: dict = {}
    if draw(st.booleans()):
        fields["calories"] = draw(_positive_floats)
    if draw(st.booleans()):
        fields["protein_g"] = draw(_positive_floats)
    if draw(st.booleans()):
        fields["carbs_g"] = draw(_positive_floats)
    if draw(st.booleans()):
        fields["fat_g"] = draw(_positive_floats)
    # Ensure at least one field changes
    if not fields:
        fields["calories"] = draw(_positive_floats)
    return CustomMealUpdate(**fields)


# ---------------------------------------------------------------------------
# Shared settings
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
# Property 11: Meal plan save round-trip
# ---------------------------------------------------------------------------


class TestProperty11MealPlanSaveRoundTrip:
    """Property 11: Meal plan save round-trip.

    Create meal plan via service, retrieve, verify name and macros match.

    **Validates: Requirements 8.4**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=custom_meal_strategy())
    async def test_create_and_retrieve_meal_plan(
        self, data: CustomMealCreate, db_session: AsyncSession
    ):
        """Creating a meal plan and retrieving it returns matching name and macros.

        **Validates: Requirements 8.4**
        """
        user = await _create_test_user(db_session)
        service = MealService(db_session)

        # Create
        meal = await service.create_custom_meal(user.id, data)

        # Retrieve via list
        pagination = PaginationParams(page=1, limit=100)
        result = await service.get_custom_meals(user.id, pagination)
        found = [m for m in result.items if m.id == meal.id]

        assert len(found) == 1, "Created meal plan should appear in list"
        retrieved = found[0]

        assert retrieved.name == data.name, "Name must match"
        assert retrieved.calories == data.calories, "Calories must match"
        assert retrieved.protein_g == data.protein_g, "Protein must match"
        assert retrieved.carbs_g == data.carbs_g, "Carbs must match"
        assert retrieved.fat_g == data.fat_g, "Fat must match"


# ---------------------------------------------------------------------------
# Property 12: Meal plan edit does not alter logged entries
# ---------------------------------------------------------------------------


class TestProperty12EditDoesNotAlterEntries:
    """Property 12: Meal plan edit does not alter logged entries.

    Create plan, log nutrition entry, edit plan, verify entry unchanged.

    **Validates: Requirements 8.7**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        meal_data=custom_meal_strategy(),
        update_data=custom_meal_update_strategy(),
    )
    async def test_edit_plan_preserves_logged_entry(
        self,
        meal_data: CustomMealCreate,
        update_data: CustomMealUpdate,
        db_session: AsyncSession,
    ):
        """Editing a meal plan does not change previously logged nutrition entries.

        **Validates: Requirements 8.7**
        """
        user = await _create_test_user(db_session)
        meal_service = MealService(db_session)
        nutrition_service = NutritionService(db_session)

        # 1. Create meal plan
        meal = await meal_service.create_custom_meal(user.id, meal_data)

        # 2. Log a nutrition entry from the plan
        entry_create = NutritionEntryCreate(
            meal_name=meal.name,
            calories=meal.calories,
            protein_g=meal.protein_g,
            carbs_g=meal.carbs_g,
            fat_g=meal.fat_g,
            entry_date=date.today(),
            source_meal_id=meal.id,
        )
        entry = await nutrition_service.create_entry(user.id, entry_create)

        # Capture original values
        orig_calories = entry.calories
        orig_protein = entry.protein_g
        orig_carbs = entry.carbs_g
        orig_fat = entry.fat_g
        orig_name = entry.meal_name

        # 3. Edit the meal plan
        await meal_service.update_custom_meal(user.id, meal.id, update_data)

        # 4. Verify entry is unchanged
        await db_session.refresh(entry)
        assert entry.calories == orig_calories, "Entry calories must not change"
        assert entry.protein_g == orig_protein, "Entry protein must not change"
        assert entry.carbs_g == orig_carbs, "Entry carbs must not change"
        assert entry.fat_g == orig_fat, "Entry fat must not change"
        assert entry.meal_name == orig_name, "Entry meal_name must not change"


# ---------------------------------------------------------------------------
# Property 13: Meal plan soft-delete is recoverable
# ---------------------------------------------------------------------------


class TestProperty13SoftDeleteRecoverable:
    """Property 13: Meal plan soft-delete is recoverable.

    Create plan, soft-delete, verify deleted_at set and excluded from GET.

    **Validates: Requirements 8.8**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=custom_meal_strategy())
    async def test_soft_delete_sets_deleted_at_and_excludes_from_list(
        self, data: CustomMealCreate, db_session: AsyncSession
    ):
        """Soft-deleting a meal plan sets deleted_at and hides it from normal queries.

        **Validates: Requirements 8.8**
        """
        user = await _create_test_user(db_session)
        service = MealService(db_session)

        # Create
        meal = await service.create_custom_meal(user.id, data)
        meal_id = meal.id

        # Soft-delete
        await service.delete_custom_meal(user.id, meal_id)

        # Verify deleted_at is set
        await db_session.refresh(meal)
        assert meal.deleted_at is not None, "deleted_at must be set after soft-delete"

        # Verify excluded from normal GET queries
        pagination = PaginationParams(page=1, limit=100)
        result = await service.get_custom_meals(user.id, pagination)
        listed_ids = [m.id for m in result.items]
        assert meal_id not in listed_ids, "Soft-deleted plan must not appear in list"
