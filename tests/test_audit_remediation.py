"""Tests for audit remediation changes.

Covers: XSS on meals, macro rounding, ContextVar isolation,
input validation bounds, goal_rate bounds.
"""

import uuid
from datetime import date

import pytest
from pydantic import ValidationError

from src.modules.meals.schemas import CustomMealCreate, CustomMealUpdate, MealFavoriteCreate
from src.modules.nutrition.schemas import NutritionEntryCreate, NutritionEntryUpdate
from src.modules.user.schemas import UserMetricCreate, UserGoalSet


# ─── XSS Sanitization on Meals ──────────────────────────────────────────────


class TestMealXSSSanitization:
    """Verify HTML is stripped from meal name fields."""

    def test_script_tag_stripped_from_create(self):
        m = CustomMealCreate(
            name="<script>alert(1)</script>Chicken",
            calories=200, protein_g=30, carbs_g=0, fat_g=5,
        )
        assert "<script>" not in m.name
        assert "Chicken" in m.name

    def test_img_onerror_stripped_from_create(self):
        m = CustomMealCreate(
            name='<img onerror="alert(1)">Rice',
            calories=100, protein_g=2, carbs_g=22, fat_g=0,
        )
        assert "<img" not in m.name
        assert "Rice" in m.name

    def test_html_stripped_from_update(self):
        m = CustomMealUpdate(name="<b>Bold</b> Salad")
        assert "<b>" not in m.name
        assert "Salad" in m.name

    def test_html_stripped_from_favorite(self):
        m = MealFavoriteCreate(
            name="<div>Wrapped</div>",
            calories=100, protein_g=10, carbs_g=10, fat_g=5,
        )
        assert "<div>" not in m.name

    def test_ampersand_escaped(self):
        m = CustomMealCreate(
            name="Fish & Chips",
            calories=500, protein_g=20, carbs_g=50, fat_g=25,
        )
        assert "&amp;" in m.name

    def test_clean_name_unchanged(self):
        m = CustomMealCreate(
            name="Grilled Chicken Breast",
            calories=165, protein_g=31, carbs_g=0, fat_g=3.6,
        )
        assert m.name == "Grilled Chicken Breast"


# ─── Macro Rounding ─────────────────────────────────────────────────────────


class TestMacroRounding:
    """Verify macros are rounded to 1 decimal on write."""

    def test_create_rounds_to_1_decimal(self):
        e = NutritionEntryCreate(
            meal_name="Test",
            calories=100.456,
            protein_g=25.999,
            carbs_g=10.555,
            fat_g=5.111,
            entry_date=date.today(),
        )
        assert e.calories == 100.5
        assert e.protein_g == 26.0
        assert e.carbs_g == 10.6
        assert e.fat_g == 5.1

    def test_update_rounds_to_1_decimal(self):
        u = NutritionEntryUpdate(calories=99.999, protein_g=0.04)
        assert u.calories == 100.0
        assert u.protein_g == 0.0

    def test_update_none_fields_stay_none(self):
        u = NutritionEntryUpdate(calories=50.0)
        assert u.protein_g is None
        assert u.carbs_g is None

    def test_zero_stays_zero(self):
        e = NutritionEntryCreate(
            meal_name="Water",
            calories=0.0, protein_g=0.0, carbs_g=0.0, fat_g=0.0,
            entry_date=date.today(),
        )
        assert e.calories == 0.0


# ─── ContextVar Isolation ────────────────────────────────────────────────────


class TestContextVarIsolation:
    """Verify audit entries don't leak between requests."""

    def test_default_is_none_not_shared_list(self):
        from src.middleware.audit_logger import _pending_audits
        assert _pending_audits.get() is None

    def test_separate_contexts_dont_share(self):
        import contextvars
        from src.middleware.audit_logger import _pending_audits, record_audit, AuditAction

        # Simulate request 1
        ctx1 = contextvars.copy_context()
        def req1():
            record_audit(
                user_id=uuid.uuid4(),
                action=AuditAction.CREATE,
                entity_type="test",
                entity_id=uuid.uuid4(),
            )
            return _pending_audits.get()

        entries1 = ctx1.run(req1)
        assert len(entries1) == 1

        # Simulate request 2 — should start fresh
        ctx2 = contextvars.copy_context()
        def req2():
            return _pending_audits.get()

        entries2 = ctx2.run(req2)
        # New context should get None (the default), not request 1's entries
        assert entries2 is None


# ─── Input Validation Bounds ─────────────────────────────────────────────────


class TestInputValidationBounds:
    """Verify schema bounds reject invalid values."""

    def test_height_below_50_rejected(self):
        with pytest.raises(ValidationError, match="height_cm"):
            UserMetricCreate(height_cm=5.9)

    def test_height_above_300_rejected(self):
        with pytest.raises(ValidationError):
            UserMetricCreate(height_cm=301)

    def test_weight_above_500_rejected(self):
        with pytest.raises(ValidationError):
            UserMetricCreate(weight_kg=501)

    def test_valid_metric_values_accepted(self):
        m = UserMetricCreate(height_cm=175, weight_kg=80)
        assert m.height_cm == 175
        assert m.weight_kg == 80

    def test_goal_rate_above_2_rejected(self):
        with pytest.raises(ValidationError, match="goal_rate"):
            UserGoalSet(goal_type="bulking", goal_rate_per_week=3.0)

    def test_goal_rate_below_minus_2_rejected(self):
        with pytest.raises(ValidationError, match="goal_rate"):
            UserGoalSet(goal_type="cutting", goal_rate_per_week=-3.0)

    def test_valid_goal_rate_accepted(self):
        g = UserGoalSet(goal_type="cutting", goal_rate_per_week=-1.0)
        assert g.goal_rate_per_week == -1.0

    def test_weight_300_accepted(self):
        """300kg is extreme but valid — should not be rejected as imperial."""
        m = UserMetricCreate(weight_kg=300)
        assert m.weight_kg == 300

    def test_height_50_accepted(self):
        """50cm is the boundary — should be accepted."""
        m = UserMetricCreate(height_cm=50)
        assert m.height_cm == 50
