"""Property-based tests for the food database module.

Tests Properties 15 and 16 from the design document using Hypothesis.
Operates at the service level using the db_session fixture.
"""

from __future__ import annotations

import uuid
import math
from unittest.mock import AsyncMock, patch

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.food_database.models import FoodItem, RecipeIngredient
from src.modules.food_database.schemas import FoodItemCreate
from src.modules.food_database.service import (
    FoodDatabaseService,
    aggregate_recipe_nutrition,
)
from src.modules.auth.models import User
from src.shared.pagination import PaginationParams


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_positive_floats = st.floats(
    min_value=0.1, max_value=5000.0, allow_nan=False, allow_infinity=False
)

_serving_sizes = st.floats(
    min_value=1.0, max_value=1000.0, allow_nan=False, allow_infinity=False
)

_micro_nutrient_keys = st.sampled_from(
    ["fiber", "sodium", "iron", "calcium", "vitamin_d", "vitamin_b12", "vitamin_c"]
)

_micro_nutrients = st.one_of(
    st.none(),
    st.dictionaries(
        keys=_micro_nutrient_keys,
        values=st.floats(min_value=0.0, max_value=500.0, allow_nan=False, allow_infinity=False),
        min_size=0,
        max_size=4,
    ),
)

_food_names = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "Zs"), min_codepoint=32, max_codepoint=127),
    min_size=1,
    max_size=80,
).filter(lambda s: s.strip() != "")

_categories = st.sampled_from(["Curry", "Bread", "Grain", "Breakfast", "Protein", "Side", "Dessert"])


@st.composite
def food_item_strategy(draw):
    """Generate a valid food item data dict for creating FoodItem models."""
    return {
        "name": draw(_food_names),
        "category": draw(_categories),
        "region": "IN",
        "serving_size": draw(_serving_sizes),
        "serving_unit": "g",
        "calories": draw(_positive_floats),
        "protein_g": draw(_positive_floats),
        "carbs_g": draw(_positive_floats),
        "fat_g": draw(_positive_floats),
        "micro_nutrients": draw(_micro_nutrients),
    }


@st.composite
def ingredient_quantity_strategy(draw):
    """Generate a positive quantity for a recipe ingredient."""
    return draw(st.floats(min_value=1.0, max_value=500.0, allow_nan=False, allow_infinity=False))


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


async def _create_food_item(db: AsyncSession, data: dict) -> FoodItem:
    """Create a FoodItem directly in the database."""
    item = FoodItem(
        id=uuid.uuid4(),
        name=data["name"],
        category=data["category"],
        region=data.get("region", "IN"),
        serving_size=data.get("serving_size", 100.0),
        serving_unit=data.get("serving_unit", "g"),
        calories=data["calories"],
        protein_g=data["protein_g"],
        carbs_g=data["carbs_g"],
        fat_g=data["fat_g"],
        micro_nutrients=data.get("micro_nutrients"),
        is_recipe=data.get("is_recipe", False),
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


# ---------------------------------------------------------------------------
# Property 15: Recipe nutritional aggregation
# ---------------------------------------------------------------------------


class TestProperty15RecipeNutritionalAggregation:
    """Property 15: Recipe nutritional aggregation.

    For any recipe composed of ingredient food items with specified quantities,
    the recipe's total nutritional values SHALL equal the sum of each
    ingredient's nutritional values scaled by (quantity / serving_size).

    **Validates: Requirements 5.3**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        ingredients_data=st.lists(food_item_strategy(), min_size=1, max_size=5),
        quantities=st.lists(
            ingredient_quantity_strategy(), min_size=1, max_size=5
        ),
    )
    async def test_recipe_aggregation_equals_sum_of_scaled_ingredients(
        self,
        ingredients_data: list[dict],
        quantities: list[float],
        db_session: AsyncSession,
    ):
        """Total recipe nutrition equals sum of scaled ingredient nutrition.

        **Validates: Requirements 5.3**
        """
        # Ensure quantities list matches ingredients list length
        n = min(len(ingredients_data), len(quantities))
        ingredients_data = ingredients_data[:n]
        quantities = quantities[:n]

        # Create ingredient food items in DB
        ingredient_items = []
        for data in ingredients_data:
            item = await _create_food_item(db_session, data)
            ingredient_items.append(item)

        # Create recipe food item
        recipe_data = {
            "name": "Test Recipe",
            "category": "Curry",
            "region": "IN",
            "serving_size": 100.0,
            "serving_unit": "g",
            "calories": 0.0,
            "protein_g": 0.0,
            "carbs_g": 0.0,
            "fat_g": 0.0,
            "is_recipe": True,
        }
        recipe = await _create_food_item(db_session, recipe_data)

        # Create recipe ingredients
        recipe_ingredients = []
        for item, qty in zip(ingredient_items, quantities):
            ri = RecipeIngredient(
                id=uuid.uuid4(),
                recipe_id=recipe.id,
                food_item_id=item.id,
                quantity=qty,
                unit="g",
            )
            ri.food_item = item  # Attach for pure function
            db_session.add(ri)
            recipe_ingredients.append(ri)
        await db_session.flush()

        # Compute aggregated nutrition using the pure function
        nutrition = aggregate_recipe_nutrition(recipe_ingredients)

        # Manually compute expected values
        expected_calories = 0.0
        expected_protein = 0.0
        expected_carbs = 0.0
        expected_fat = 0.0
        expected_micros: dict[str, float] = {}

        for item, qty in zip(ingredient_items, quantities):
            scale = qty / item.serving_size if item.serving_size > 0 else 0.0
            expected_calories += item.calories * scale
            expected_protein += item.protein_g * scale
            expected_carbs += item.carbs_g * scale
            expected_fat += item.fat_g * scale
            if item.micro_nutrients:
                for key, value in item.micro_nutrients.items():
                    expected_micros[key] = expected_micros.get(key, 0.0) + value * scale

        # Assert with tolerance for floating point
        assert math.isclose(nutrition.total_calories, expected_calories, rel_tol=1e-9), (
            f"Calories: {nutrition.total_calories} != {expected_calories}"
        )
        assert math.isclose(nutrition.total_protein_g, expected_protein, rel_tol=1e-9), (
            f"Protein: {nutrition.total_protein_g} != {expected_protein}"
        )
        assert math.isclose(nutrition.total_carbs_g, expected_carbs, rel_tol=1e-9), (
            f"Carbs: {nutrition.total_carbs_g} != {expected_carbs}"
        )
        assert math.isclose(nutrition.total_fat_g, expected_fat, rel_tol=1e-9), (
            f"Fat: {nutrition.total_fat_g} != {expected_fat}"
        )

        # Check micro-nutrients
        for key, expected_val in expected_micros.items():
            actual_val = nutrition.total_micro_nutrients.get(key, 0.0)
            assert math.isclose(actual_val, expected_val, rel_tol=1e-9), (
                f"Micro {key}: {actual_val} != {expected_val}"
            )

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=food_item_strategy())
    async def test_single_ingredient_recipe_matches_scaled_item(
        self,
        data: dict,
        db_session: AsyncSession,
    ):
        """A recipe with one ingredient should match that ingredient scaled.

        **Validates: Requirements 5.3**
        """
        item = await _create_food_item(db_session, data)

        # Use quantity equal to serving_size → scale factor = 1.0
        ri = RecipeIngredient(
            id=uuid.uuid4(),
            recipe_id=uuid.uuid4(),
            food_item_id=item.id,
            quantity=item.serving_size,
            unit="g",
        )
        ri.food_item = item

        nutrition = aggregate_recipe_nutrition([ri])

        assert math.isclose(nutrition.total_calories, item.calories, rel_tol=1e-9)
        assert math.isclose(nutrition.total_protein_g, item.protein_g, rel_tol=1e-9)
        assert math.isclose(nutrition.total_carbs_g, item.carbs_g, rel_tol=1e-9)
        assert math.isclose(nutrition.total_fat_g, item.fat_g, rel_tol=1e-9)


# ---------------------------------------------------------------------------
# Property 16: Food search relevance
# ---------------------------------------------------------------------------


class TestProperty16FoodSearchRelevance:
    """Property 16: Food search relevance.

    For any search query against the Food Database, all returned food items
    SHALL contain the search term (case-insensitive) in their name field.

    **Validates: Requirements 5.2**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        items_data=st.lists(food_item_strategy(), min_size=2, max_size=6),
    )
    async def test_search_results_contain_query_term(
        self,
        items_data: list[dict],
        db_session: AsyncSession,
    ):
        """All search results must contain the query term in their name.

        **Validates: Requirements 5.2**
        """
        # Create food items in DB
        created_items = []
        for data in items_data:
            item = await _create_food_item(db_session, data)
            created_items.append(item)

        # Use the beginning of the first item's name as search query (prefix match)
        target_name = created_items[0].name
        query = target_name[:max(4, len(target_name) // 2)]

        service = FoodDatabaseService(db_session)
        pagination = PaginationParams(page=1, limit=100)
        result = await service.search(query, pagination)

        # Only check items from local DB (which match by ilike).
        for item in result.items:
            is_local = any(c.id == item.id for c in created_items)
            if is_local:
                assert query.lower() in item.name.lower(), (
                    f"Local search result '{item.name}' does not contain query '{query}'"
                )

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=food_item_strategy())
    async def test_exact_name_search_returns_item(
        self,
        data: dict,
        db_session: AsyncSession,
    ):
        """Searching by exact name should return the matching item.

        **Validates: Requirements 5.2**
        """
        item = await _create_food_item(db_session, data)

        service = FoodDatabaseService(db_session)
        pagination = PaginationParams(page=1, limit=100)
        result = await service.search(item.name, pagination)

        found_ids = [i.id for i in result.items]
        assert item.id in found_ids, (
            f"Item '{item.name}' should appear in search results for its own name"
        )

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=food_item_strategy())
    async def test_case_insensitive_search(
        self,
        data: dict,
        db_session: AsyncSession,
    ):
        """Search should be case-insensitive.

        **Validates: Requirements 5.2**
        """
        item = await _create_food_item(db_session, data)

        service = FoodDatabaseService(db_session)
        pagination = PaginationParams(page=1, limit=100)

        # Search with uppercase version
        result = await service.search(item.name.upper(), pagination)

        found_ids = [i.id for i in result.items]
        assert item.id in found_ids, "Case-insensitive search should find the item"


# ---------------------------------------------------------------------------
# Global food search tests
# ---------------------------------------------------------------------------


class TestGlobalFoodSearch:
    """Test that common global foods are searchable after seeding."""

    @pytest.mark.asyncio
    async def test_apple_search_returns_results(self, db_session: AsyncSession):
        """Searching for 'apple' should return Apple from global seed data."""
        # Seed the apple item
        from src.modules.food_database.global_seed_data import GLOBAL_FOOD_ITEMS
        apple_data = next(item for item in GLOBAL_FOOD_ITEMS if item["name"] == "Apple")
        item = FoodItem(
            name=apple_data["name"],
            category=apple_data["category"],
            region=apple_data["region"],
            serving_size=apple_data["serving_size"],
            serving_unit=apple_data["serving_unit"],
            calories=apple_data["calories"],
            protein_g=apple_data["protein_g"],
            carbs_g=apple_data["carbs_g"],
            fat_g=apple_data["fat_g"],
            micro_nutrients=apple_data.get("micro_nutrients"),
            source=apple_data.get("source", "usda"),
        )
        db_session.add(item)
        await db_session.flush()

        service = FoodDatabaseService(db_session)
        pagination = PaginationParams(page=1, limit=20)
        result = await service.search("apple", pagination)

        assert len(result.items) >= 1
        names = [i.name.lower() for i in result.items]
        assert any("apple" in n for n in names)

    @pytest.mark.asyncio
    async def test_banana_search_returns_results(self, db_session: AsyncSession):
        """Searching for 'banana' should return Banana from global seed data."""
        from src.modules.food_database.global_seed_data import GLOBAL_FOOD_ITEMS
        banana_data = next(item for item in GLOBAL_FOOD_ITEMS if item["name"] == "Banana")
        item = FoodItem(
            name=banana_data["name"],
            category=banana_data["category"],
            region=banana_data["region"],
            serving_size=banana_data["serving_size"],
            serving_unit=banana_data["serving_unit"],
            calories=banana_data["calories"],
            protein_g=banana_data["protein_g"],
            carbs_g=banana_data["carbs_g"],
            fat_g=banana_data["fat_g"],
            source=banana_data.get("source", "usda"),
        )
        db_session.add(item)
        await db_session.flush()

        service = FoodDatabaseService(db_session)
        pagination = PaginationParams(page=1, limit=20)
        result = await service.search("banana", pagination)

        assert len(result.items) >= 1
        names = [i.name.lower() for i in result.items]
        assert any("banana" in n for n in names)

    @pytest.mark.asyncio
    async def test_chicken_search_returns_results(self, db_session: AsyncSession):
        """Searching for 'chicken' should return chicken items."""
        from src.modules.food_database.global_seed_data import GLOBAL_FOOD_ITEMS
        chicken_items = [item for item in GLOBAL_FOOD_ITEMS if "chicken" in item["name"].lower()]
        for data in chicken_items[:3]:
            item = FoodItem(
                name=data["name"],
                category=data["category"],
                region=data["region"],
                serving_size=data["serving_size"],
                serving_unit=data["serving_unit"],
                calories=data["calories"],
                protein_g=data["protein_g"],
                carbs_g=data["carbs_g"],
                fat_g=data["fat_g"],
                source=data.get("source", "usda"),
            )
            db_session.add(item)
        await db_session.flush()

        service = FoodDatabaseService(db_session)
        pagination = PaginationParams(page=1, limit=20)
        result = await service.search("chicken", pagination)

        assert len(result.items) >= 1
        names = [i.name.lower() for i in result.items]
        assert any("chicken" in n for n in names)
