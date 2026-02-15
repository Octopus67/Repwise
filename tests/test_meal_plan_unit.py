"""Unit tests for meal plan generation, scaling, shopping list, and edge cases.

Feature: meal-prep-assistant (Feature 12)
Tests: generator.py, scaler.py, shopping.py pure functions
"""

from __future__ import annotations

import uuid

import pytest

from src.modules.meal_plans.generator import (
    DEFAULT_SLOT_SPLITS,
    DayPlan,
    FoodCandidate,
    GeneratedPlan,
    MacroSummary,
    MealAssignment,
    compute_day_summary,
    compute_weekly_summary,
    distribute_macros,
    generate_plan,
)
from src.modules.meal_plans.scaler import (
    IngredientInput,
    ScaledRecipe,
    compute_scale_factor,
    scale_recipe,
)
from src.modules.meal_plans.shopping import (
    IngredientEntry,
    ShoppingItem,
    ShoppingList,
    consolidate_ingredients,
    normalize_unit,
    resolve_category,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_candidate(
    name: str = "Chicken Breast",
    calories: float = 200.0,
    protein_g: float = 30.0,
    carbs_g: float = 0.0,
    fat_g: float = 5.0,
    priority: int = 0,
) -> FoodCandidate:
    return FoodCandidate(
        food_item_id=uuid.uuid4(),
        name=name,
        calories=calories,
        protein_g=protein_g,
        carbs_g=carbs_g,
        fat_g=fat_g,
        is_recipe=False,
        source_priority=priority,
    )


def _make_targets(
    calories: float = 2000.0,
    protein_g: float = 150.0,
    carbs_g: float = 250.0,
    fat_g: float = 70.0,
) -> MacroSummary:
    return MacroSummary(
        calories=calories, protein_g=protein_g, carbs_g=carbs_g, fat_g=fat_g
    )


# ===========================================================================
# Generator tests
# ===========================================================================


class TestDistributeMacros:
    """Tests for distribute_macros."""

    def test_default_splits_sum_to_one(self):
        total = sum(DEFAULT_SLOT_SPLITS.values())
        assert abs(total - 1.0) < 0.01

    def test_distribute_with_default_splits(self):
        targets = _make_targets(2000, 150, 250, 70)
        slots = distribute_macros(targets)
        assert len(slots) == 4
        total_cal = sum(s.calories for s in slots)
        assert abs(total_cal - 2000.0) < 1.0

    def test_distribute_custom_splits(self):
        targets = _make_targets(1000, 100, 100, 50)
        splits = {"meal1": 0.6, "meal2": 0.4}
        slots = distribute_macros(targets, splits)
        assert len(slots) == 2
        assert slots[0].slot == "meal1"
        assert abs(slots[0].calories - 600.0) < 0.01
        assert abs(slots[1].calories - 400.0) < 0.01

    def test_distribute_raises_on_bad_splits(self):
        targets = _make_targets()
        with pytest.raises(ValueError, match="sum to ~1.0"):
            distribute_macros(targets, {"a": 0.5, "b": 0.3})

    def test_distribute_raises_on_over_splits(self):
        targets = _make_targets()
        with pytest.raises(ValueError, match="sum to ~1.0"):
            distribute_macros(targets, {"a": 0.8, "b": 0.8})


class TestComputeSummaries:
    """Tests for compute_day_summary and compute_weekly_summary."""

    def test_day_summary_empty(self):
        s = compute_day_summary([])
        assert s.calories == 0.0
        assert s.protein_g == 0.0

    def test_day_summary_single(self):
        a = MealAssignment(
            slot="lunch",
            food_item_id=uuid.uuid4(),
            name="Rice",
            calories=300.0,
            protein_g=6.0,
            carbs_g=65.0,
            fat_g=1.0,
            scale_factor=1.0,
            is_recipe=False,
        )
        s = compute_day_summary([a])
        assert s.calories == 300.0
        assert s.protein_g == 6.0

    def test_day_summary_multiple(self):
        a1 = MealAssignment(
            slot="breakfast", food_item_id=uuid.uuid4(), name="Eggs",
            calories=150, protein_g=12, carbs_g=1, fat_g=10,
            scale_factor=1.0, is_recipe=False,
        )
        a2 = MealAssignment(
            slot="lunch", food_item_id=uuid.uuid4(), name="Rice",
            calories=300, protein_g=6, carbs_g=65, fat_g=1,
            scale_factor=1.0, is_recipe=False,
        )
        s = compute_day_summary([a1, a2])
        assert s.calories == 450.0
        assert s.protein_g == 18.0

    def test_weekly_summary(self):
        d1 = MacroSummary(calories=2000, protein_g=150, carbs_g=250, fat_g=70)
        d2 = MacroSummary(calories=1800, protein_g=140, carbs_g=230, fat_g=65)
        w = compute_weekly_summary([d1, d2])
        assert w.calories == 3800.0
        assert w.protein_g == 290.0

    def test_weekly_summary_empty(self):
        w = compute_weekly_summary([])
        assert w.calories == 0.0


class TestGeneratePlan:
    """Tests for generate_plan."""

    def test_empty_candidates_returns_unfilled(self):
        targets = _make_targets()
        plan = generate_plan(targets, [], num_days=3)
        assert len(plan.days) == 3
        for day in plan.days:
            assert len(day.assignments) == 0
            assert len(day.unfilled_slots) == 4

    def test_single_candidate_fills_all_slots(self):
        targets = _make_targets(2000, 150, 250, 70)
        cand = _make_candidate(calories=500, protein_g=40, carbs_g=60, fat_g=15)
        plan = generate_plan(targets, [cand], num_days=1)
        assert len(plan.days) == 1
        assert len(plan.days[0].assignments) == 4
        assert len(plan.days[0].unfilled_slots) == 0

    def test_plan_respects_num_days(self):
        targets = _make_targets()
        cand = _make_candidate()
        for n in [1, 3, 7]:
            plan = generate_plan(targets, [cand], num_days=n)
            assert len(plan.days) == n

    def test_plan_invalid_num_days_raises(self):
        targets = _make_targets()
        with pytest.raises(ValueError, match="num_days must be between"):
            generate_plan(targets, [], num_days=0)
        with pytest.raises(ValueError, match="num_days must be between"):
            generate_plan(targets, [], num_days=15)

    def test_plan_scale_factor_positive(self):
        targets = _make_targets(2000, 150, 250, 70)
        cand = _make_candidate(calories=400)
        plan = generate_plan(targets, [cand], num_days=1)
        for a in plan.days[0].assignments:
            assert a.scale_factor > 0

    def test_weekly_summary_matches_day_sums(self):
        targets = _make_targets(2000, 150, 250, 70)
        cand = _make_candidate(calories=500, protein_g=40, carbs_g=60, fat_g=15)
        plan = generate_plan(targets, [cand], num_days=3)
        expected_cal = sum(s.calories for s in plan.daily_macro_summaries)
        assert abs(plan.weekly_macro_summary.calories - expected_cal) < 0.1

    def test_zero_calorie_candidates_skipped(self):
        targets = _make_targets()
        zero_cand = _make_candidate(calories=0, protein_g=0, carbs_g=0, fat_g=0)
        plan = generate_plan(targets, [zero_cand], num_days=1)
        assert len(plan.days[0].assignments) == 0
        assert len(plan.days[0].unfilled_slots) == 4

    def test_priority_ordering(self):
        targets = _make_targets(2000, 150, 250, 70)
        fav = _make_candidate(name="Favorite", calories=500, priority=0)
        db_item = _make_candidate(name="DB Item", calories=500, priority=2)
        plan = generate_plan(targets, [db_item, fav], num_days=1)
        # Favorites (priority 0) should be preferred
        names = [a.name for a in plan.days[0].assignments]
        assert "Favorite" in names


# ===========================================================================
# Scaler tests
# ===========================================================================


class TestComputeScaleFactor:
    """Tests for compute_scale_factor."""

    def test_basic_scaling(self):
        assert compute_scale_factor(100, 200) == 2.0

    def test_scale_down(self):
        assert compute_scale_factor(200, 100) == 0.5

    def test_identity(self):
        assert compute_scale_factor(100, 100) == 1.0

    def test_zero_original_raises(self):
        with pytest.raises(ValueError, match="non-positive"):
            compute_scale_factor(0, 100)

    def test_negative_original_raises(self):
        with pytest.raises(ValueError, match="non-positive"):
            compute_scale_factor(-50, 100)


class TestScaleRecipe:
    """Tests for scale_recipe."""

    def test_scale_by_calories(self):
        rid = uuid.uuid4()
        ingredients = [
            IngredientInput(food_item_id=uuid.uuid4(), name="Rice", quantity=100, unit="g"),
            IngredientInput(food_item_id=uuid.uuid4(), name="Chicken", quantity=150, unit="g"),
        ]
        result = scale_recipe(
            recipe_id=rid,
            recipe_calories=500,
            recipe_protein_g=40,
            recipe_carbs_g=60,
            recipe_fat_g=15,
            ingredients=ingredients,
            target_value=1000,
            target_macro="calories",
        )
        assert result.scale_factor == pytest.approx(2.0, abs=0.001)
        assert result.calories == pytest.approx(1000.0, abs=0.1)
        assert result.ingredients[0].scaled_quantity == pytest.approx(200.0, abs=0.1)
        assert result.ingredients[1].scaled_quantity == pytest.approx(300.0, abs=0.1)

    def test_scale_by_protein(self):
        rid = uuid.uuid4()
        result = scale_recipe(
            recipe_id=rid,
            recipe_calories=500,
            recipe_protein_g=25,
            recipe_carbs_g=60,
            recipe_fat_g=15,
            ingredients=[],
            target_value=50,
            target_macro="protein_g",
        )
        assert result.scale_factor == pytest.approx(2.0, abs=0.001)
        assert result.protein_g == pytest.approx(50.0, abs=0.1)

    def test_unknown_macro_raises(self):
        with pytest.raises(ValueError, match="Unknown target_macro"):
            scale_recipe(
                recipe_id=uuid.uuid4(),
                recipe_calories=500,
                recipe_protein_g=40,
                recipe_carbs_g=60,
                recipe_fat_g=15,
                ingredients=[],
                target_value=100,
                target_macro="fiber_g",
            )

    def test_zero_macro_raises(self):
        with pytest.raises(ValueError, match="non-positive"):
            scale_recipe(
                recipe_id=uuid.uuid4(),
                recipe_calories=0,
                recipe_protein_g=40,
                recipe_carbs_g=60,
                recipe_fat_g=15,
                ingredients=[],
                target_value=100,
                target_macro="calories",
            )


# ===========================================================================
# Shopping list tests
# ===========================================================================


class TestResolveCategory:
    """Tests for resolve_category."""

    def test_direct_valid_category(self):
        assert resolve_category("produce") == "produce"
        assert resolve_category("protein") == "protein"

    def test_mapped_category(self):
        assert resolve_category("chicken") == "protein"
        assert resolve_category("vegetables") == "produce"
        assert resolve_category("rice") == "grains"
        assert resolve_category("milk") == "dairy"

    def test_case_insensitive(self):
        assert resolve_category("CHICKEN") == "protein"
        assert resolve_category("Vegetables") == "produce"

    def test_unknown_returns_other(self):
        assert resolve_category("spices") == "other"
        assert resolve_category("") == "other"

    def test_keyword_match(self):
        assert resolve_category("fresh chicken breast") == "protein"


class TestNormalizeUnit:
    """Tests for normalize_unit."""

    def test_same_unit(self):
        assert normalize_unit(100, "g", "g") == 100

    def test_g_to_kg(self):
        result = normalize_unit(1000, "g", "kg")
        assert result is not None
        assert result == pytest.approx(1.0)

    def test_ml_to_l(self):
        result = normalize_unit(500, "ml", "l")
        assert result is not None
        assert result == pytest.approx(0.5)

    def test_unknown_conversion(self):
        assert normalize_unit(100, "cups", "ml") is None

    def test_tsp_to_tbsp(self):
        result = normalize_unit(3, "tsp", "tbsp")
        assert result is not None
        assert result == pytest.approx(1.0)


class TestConsolidateIngredients:
    """Tests for consolidate_ingredients."""

    def test_empty_list(self):
        result = consolidate_ingredients([])
        assert result.items == []

    def test_single_ingredient(self):
        entries = [
            IngredientEntry(name="Rice", quantity=200, unit="g", food_category="grains"),
        ]
        result = consolidate_ingredients(entries)
        assert len(result.items) == 1
        assert result.items[0].name == "Rice"
        assert result.items[0].quantity == 200
        assert result.items[0].category == "grains"

    def test_duplicate_aggregation(self):
        entries = [
            IngredientEntry(name="Rice", quantity=200, unit="g", food_category="grains"),
            IngredientEntry(name="Rice", quantity=150, unit="g", food_category="grains"),
        ]
        result = consolidate_ingredients(entries)
        assert len(result.items) == 1
        assert result.items[0].quantity == 350

    def test_case_insensitive_aggregation(self):
        entries = [
            IngredientEntry(name="rice", quantity=100, unit="g", food_category="grains"),
            IngredientEntry(name="Rice", quantity=100, unit="g", food_category="grains"),
        ]
        result = consolidate_ingredients(entries)
        assert len(result.items) == 1
        assert result.items[0].quantity == 200

    def test_different_units_not_merged_without_conversion(self):
        entries = [
            IngredientEntry(name="Flour", quantity=200, unit="g", food_category="pantry"),
            IngredientEntry(name="Flour", quantity=2, unit="cups", food_category="pantry"),
        ]
        result = consolidate_ingredients(entries)
        # cups→g has no conversion, so they stay separate
        assert len(result.items) == 2

    def test_convertible_units_merged(self):
        entries = [
            IngredientEntry(name="Water", quantity=500, unit="ml", food_category="other"),
            IngredientEntry(name="Water", quantity=1, unit="l", food_category="other"),
        ]
        result = consolidate_ingredients(entries)
        # ml→l conversion exists, should merge
        assert len(result.items) == 1

    def test_sorted_by_category_then_name(self):
        entries = [
            IngredientEntry(name="Yogurt", quantity=200, unit="g", food_category="dairy"),
            IngredientEntry(name="Apple", quantity=2, unit="pcs", food_category="produce"),
            IngredientEntry(name="Chicken", quantity=300, unit="g", food_category="protein"),
        ]
        result = consolidate_ingredients(entries)
        categories = [i.category for i in result.items]
        assert categories == sorted(categories)

    def test_negative_quantity_clamped(self):
        entries = [
            IngredientEntry(name="Rice", quantity=-50, unit="g", food_category="grains"),
        ]
        result = consolidate_ingredients(entries)
        assert len(result.items) == 1
        assert result.items[0].quantity == 0.0

    def test_multiple_categories(self):
        entries = [
            IngredientEntry(name="Chicken", quantity=300, unit="g", food_category="chicken"),
            IngredientEntry(name="Rice", quantity=200, unit="g", food_category="rice"),
            IngredientEntry(name="Broccoli", quantity=150, unit="g", food_category="vegetables"),
        ]
        result = consolidate_ingredients(entries)
        assert len(result.items) == 3
        cats = {i.category for i in result.items}
        assert "protein" in cats
        assert "grains" in cats
        assert "produce" in cats
