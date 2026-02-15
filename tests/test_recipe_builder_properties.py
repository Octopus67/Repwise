"""Property-based tests for Recipe Builder (Feature 10).

Tests Properties 12 and 13 from the design document using Hypothesis.
Operates at the service level using the db_session fixture.
"""

from __future__ import annotations

import uuid

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.food_database.models import FoodItem
from src.modules.food_database.schemas import RecipeIngredientInput
from src.modules.food_database.service import FoodDatabaseService, aggregate_recipe_nutrition
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

_total_servings = st.floats(
    min_value=0.5, max_value=100.0, allow_nan=False, allow_infinity=False
)

_quantities = st.floats(
    min_value=1.0, max_value=2000.0, allow_nan=False, allow_infinity=False
)

_servings_consumed = st.floats(
    min_value=0.1, max_value=20.0, allow_nan=False, allow_infinity=False
)

_food_names = st.text(
    alphabet=st.characters(
        whitelist_categories=("L", "N"),
        min_codepoint=65,
        max_codepoint=122,
    ),
    min_size=3,
    max_size=40,
).filter(lambda s: s.strip() != "")

_fixture_settings = h_settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_ingredient_food(
    db: AsyncSession,
    name: str,
    calories: float,
    protein_g: float,
    carbs_g: float,
    fat_g: float,
    serving_size: float = 100.0,
) -> FoodItem:
    """Create a simple food item to use as a recipe ingredient."""
    item = FoodItem(
        id=uuid.uuid4(),
        name=name,
        category="Ingredient",
        region="IN",
        serving_size=serving_size,
        serving_unit="g",
        calories=calories,
        protein_g=protein_g,
        carbs_g=carbs_g,
        fat_g=fat_g,
        source="verified",
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


# ---------------------------------------------------------------------------
# Property 12: Recipe nutrition scaling
# ---------------------------------------------------------------------------


class TestProperty12RecipeNutritionScaling:
    """Property 12: Recipe nutrition = sum of scaled ingredients / total_servings.

    For any recipe with N ingredients, the per-serving macros stored on the
    recipe FoodItem must equal the sum of each ingredient's macros scaled by
    (quantity / serving_size), divided by total_servings. When a user logs
    servings_consumed of the recipe, the logged macros must equal
    per_serving * servings_consumed, within floating-point tolerance.

    **Validates: Requirements 10.1.4, 10.2.2**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=st.data())
    async def test_recipe_per_serving_macros_match_aggregation(
        self,
        data,
        db_session: AsyncSession,
    ):
        """Per-serving macros on recipe = aggregate(ingredients) / total_servings.

        **Validates: Requirements 10.1.4**
        """
        # Generate 1-5 ingredients
        num_ingredients = data.draw(st.integers(min_value=1, max_value=5))
        total_servings = data.draw(_total_servings)

        ingredients = []
        ingredient_inputs = []
        for i in range(num_ingredients):
            cal = data.draw(_positive_floats)
            pro = data.draw(_positive_floats)
            carb = data.draw(_positive_floats)
            fat = data.draw(_positive_floats)
            serving_size = data.draw(_serving_sizes)
            quantity = data.draw(_quantities)

            food = await _create_ingredient_food(
                db_session,
                name=f"Ingredient_{uuid.uuid4().hex[:6]}",
                calories=cal,
                protein_g=pro,
                carbs_g=carb,
                fat_g=fat,
                serving_size=serving_size,
            )
            ingredients.append((food, quantity))
            ingredient_inputs.append(
                RecipeIngredientInput(
                    food_item_id=food.id,
                    quantity=quantity,
                    unit="g",
                )
            )

        # Create recipe via service
        service = FoodDatabaseService(db_session)
        recipe = await service.create_recipe(
            user_id=uuid.uuid4(),
            name=f"Recipe_{uuid.uuid4().hex[:6]}",
            description=None,
            total_servings=total_servings,
            ingredients=ingredient_inputs,
        )

        # Compute expected totals manually
        expected_cal = sum(
            food.calories * (qty / food.serving_size) for food, qty in ingredients
        )
        expected_pro = sum(
            food.protein_g * (qty / food.serving_size) for food, qty in ingredients
        )
        expected_carb = sum(
            food.carbs_g * (qty / food.serving_size) for food, qty in ingredients
        )
        expected_fat = sum(
            food.fat_g * (qty / food.serving_size) for food, qty in ingredients
        )

        # Per-serving = total / total_servings
        expected_per_serving_cal = expected_cal / total_servings
        expected_per_serving_pro = expected_pro / total_servings
        expected_per_serving_carb = expected_carb / total_servings
        expected_per_serving_fat = expected_fat / total_servings

        # Verify denormalized per-serving macros on recipe
        assert abs(recipe.calories - expected_per_serving_cal) < 0.01, (
            f"Calories mismatch: {recipe.calories} vs {expected_per_serving_cal}"
        )
        assert abs(recipe.protein_g - expected_per_serving_pro) < 0.01, (
            f"Protein mismatch: {recipe.protein_g} vs {expected_per_serving_pro}"
        )
        assert abs(recipe.carbs_g - expected_per_serving_carb) < 0.01, (
            f"Carbs mismatch: {recipe.carbs_g} vs {expected_per_serving_carb}"
        )
        assert abs(recipe.fat_g - expected_per_serving_fat) < 0.01, (
            f"Fat mismatch: {recipe.fat_g} vs {expected_per_serving_fat}"
        )

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=st.data())
    async def test_logged_macros_scale_by_servings_consumed(
        self,
        data,
        db_session: AsyncSession,
    ):
        """Logged macros = per_serving * servings_consumed.

        **Validates: Requirements 10.2.2**
        """
        # Create a simple 2-ingredient recipe
        food1 = await _create_ingredient_food(
            db_session, "Rice", calories=130, protein_g=2.7,
            carbs_g=28.0, fat_g=0.3, serving_size=100.0,
        )
        food2 = await _create_ingredient_food(
            db_session, "Chicken", calories=165, protein_g=31.0,
            carbs_g=0.0, fat_g=3.6, serving_size=100.0,
        )

        total_servings = data.draw(_total_servings)
        qty1 = data.draw(_quantities)
        qty2 = data.draw(_quantities)
        servings_consumed = data.draw(_servings_consumed)

        service = FoodDatabaseService(db_session)
        recipe = await service.create_recipe(
            user_id=uuid.uuid4(),
            name=f"Meal_{uuid.uuid4().hex[:6]}",
            description=None,
            total_servings=total_servings,
            ingredients=[
                RecipeIngredientInput(food_item_id=food1.id, quantity=qty1, unit="g"),
                RecipeIngredientInput(food_item_id=food2.id, quantity=qty2, unit="g"),
            ],
        )

        # Logged macros = per_serving * servings_consumed
        logged_cal = recipe.calories * servings_consumed
        logged_pro = recipe.protein_g * servings_consumed
        logged_carb = recipe.carbs_g * servings_consumed
        logged_fat = recipe.fat_g * servings_consumed

        # Compute expected from scratch
        total_cal = food1.calories * (qty1 / 100.0) + food2.calories * (qty2 / 100.0)
        total_pro = food1.protein_g * (qty1 / 100.0) + food2.protein_g * (qty2 / 100.0)
        total_carb = food1.carbs_g * (qty1 / 100.0) + food2.carbs_g * (qty2 / 100.0)
        total_fat = food1.fat_g * (qty1 / 100.0) + food2.fat_g * (qty2 / 100.0)

        expected_logged_cal = (total_cal / total_servings) * servings_consumed
        expected_logged_pro = (total_pro / total_servings) * servings_consumed
        expected_logged_carb = (total_carb / total_servings) * servings_consumed
        expected_logged_fat = (total_fat / total_servings) * servings_consumed

        assert abs(logged_cal - expected_logged_cal) < 0.1, (
            f"Logged calories: {logged_cal} vs expected {expected_logged_cal}"
        )
        assert abs(logged_pro - expected_logged_pro) < 0.1, (
            f"Logged protein: {logged_pro} vs expected {expected_logged_pro}"
        )
        assert abs(logged_carb - expected_logged_carb) < 0.1, (
            f"Logged carbs: {logged_carb} vs expected {expected_logged_carb}"
        )
        assert abs(logged_fat - expected_logged_fat) < 0.1, (
            f"Logged fat: {logged_fat} vs expected {expected_logged_fat}"
        )


# ---------------------------------------------------------------------------
# Property 13: Recipe searchability round-trip
# ---------------------------------------------------------------------------


class TestProperty13RecipeSearchability:
    """Property 13: Created recipe appears in food search by exact name.

    After creating a recipe, searching for its exact name must return
    the recipe in the results. Recipes are FoodItems with is_recipe=True
    and appear in regular food search.

    **Validates: Requirements 10.1.6**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=st.data())
    async def test_recipe_appears_in_search_by_name(
        self,
        data,
        db_session: AsyncSession,
    ):
        """A created recipe is findable via food search by its name.

        **Validates: Requirements 10.1.6**
        """
        # Use a unique prefix to avoid collisions
        prefix = uuid.uuid4().hex[:8]
        recipe_name = f"{prefix} TestRecipe"

        # Create an ingredient food item
        food = await _create_ingredient_food(
            db_session, "SearchIngredient", calories=100, protein_g=10,
            carbs_g=20, fat_g=5, serving_size=100.0,
        )

        total_servings = data.draw(_total_servings)

        service = FoodDatabaseService(db_session)
        recipe = await service.create_recipe(
            user_id=uuid.uuid4(),
            name=recipe_name,
            description="Test recipe for search",
            total_servings=total_servings,
            ingredients=[
                RecipeIngredientInput(food_item_id=food.id, quantity=200.0, unit="g"),
            ],
        )

        # Search for the recipe by its exact name
        pagination = PaginationParams(page=1, limit=50)
        result = await service.search(prefix, pagination)

        recipe_ids = {item.id for item in result.items}
        assert recipe.id in recipe_ids, (
            f"Recipe '{recipe_name}' (id={recipe.id}) not found in search results. "
            f"Got {len(result.items)} results."
        )

        # Verify the found item is marked as a recipe
        found = next(item for item in result.items if item.id == recipe.id)
        assert found.is_recipe is True
        assert found.source == "custom"
