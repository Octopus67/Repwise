"""Unit tests for the adaptive engine pure functions."""

from datetime import date, timedelta

import pytest

from src.modules.adaptive.engine import (
    ACTIVITY_MULTIPLIERS,
    ADJUSTMENT_CLAMP_MAX,
    ADJUSTMENT_CLAMP_MIN,
    EMA_ALPHA,
    GOAL_OFFSETS,
    MIN_CARBS_G,
    MIN_TARGET_CALORIES,
    PROTEIN_MULTIPLIERS,
    AdaptiveInput,
    AdaptiveOutput,
    _compute_bmr,
    _compute_ema,
    _compute_macros,
    _compute_tdee,
    _filter_extreme_fluctuations,
    compute_snapshot,
)
from src.shared.types import ActivityLevel, GoalType


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_history(weights: list[float], start: date | None = None) -> list[tuple[date, float]]:
    """Build a bodyweight history from a list of weights, one per day."""
    start = start or date(2024, 1, 1)
    return [(start + timedelta(days=i), w) for i, w in enumerate(weights)]


def _default_input(**overrides) -> AdaptiveInput:
    """Return a reasonable default AdaptiveInput, with optional overrides."""
    defaults = dict(
        weight_kg=80.0,
        height_cm=178.0,
        age_years=30,
        sex="male",
        activity_level=ActivityLevel.MODERATE,
        goal_type=GoalType.CUTTING,
        goal_rate_per_week=-0.5,
        bodyweight_history=_make_history([80.0 + 0.1 * i for i in range(14)]),
        training_load_score=50.0,
    )
    defaults.update(overrides)
    return AdaptiveInput(**defaults)


# ---------------------------------------------------------------------------
# Step 1: BMR
# ---------------------------------------------------------------------------

class TestBMR:
    def test_male_bmr(self):
        # 10*80 + 6.25*178 - 5*30 + 5 = 800 + 1112.5 - 150 + 5 = 1767.5
        assert _compute_bmr(80.0, 178.0, 30, "male") == pytest.approx(1767.5)

    def test_female_bmr(self):
        # 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25
        assert _compute_bmr(60.0, 165.0, 25, "female") == pytest.approx(1345.25)

    def test_bmr_increases_with_weight(self):
        lighter = _compute_bmr(70.0, 178.0, 30, "male")
        heavier = _compute_bmr(90.0, 178.0, 30, "male")
        assert heavier > lighter

    def test_bmr_decreases_with_age(self):
        younger = _compute_bmr(80.0, 178.0, 20, "male")
        older = _compute_bmr(80.0, 178.0, 40, "male")
        assert younger > older


# ---------------------------------------------------------------------------
# Step 2: TDEE
# ---------------------------------------------------------------------------

class TestTDEE:
    def test_sedentary_multiplier(self):
        bmr = 1767.5
        assert _compute_tdee(bmr, ActivityLevel.SEDENTARY) == pytest.approx(bmr * 1.2)

    def test_very_active_multiplier(self):
        bmr = 1767.5
        assert _compute_tdee(bmr, ActivityLevel.VERY_ACTIVE) == pytest.approx(bmr * 1.9)

    def test_tdee_ordering(self):
        bmr = 1800.0
        levels = [
            ActivityLevel.SEDENTARY,
            ActivityLevel.LIGHT,
            ActivityLevel.MODERATE,
            ActivityLevel.ACTIVE,
            ActivityLevel.VERY_ACTIVE,
        ]
        tdees = [_compute_tdee(bmr, lvl) for lvl in levels]
        assert tdees == sorted(tdees)


# ---------------------------------------------------------------------------
# Step 3: EMA
# ---------------------------------------------------------------------------

class TestEMA:
    def test_single_entry(self):
        history = _make_history([80.0])
        assert _compute_ema(history) == pytest.approx(80.0)

    def test_fewer_than_7_uses_simple_average(self):
        weights = [80.0, 81.0, 79.0, 80.5, 80.2]
        history = _make_history(weights)
        assert _compute_ema(history) == pytest.approx(sum(weights) / len(weights))

    def test_exactly_7_uses_ema(self):
        weights = [80.0, 80.1, 80.2, 80.3, 80.4, 80.5, 80.6]
        history = _make_history(weights)
        # Manually compute EMA
        ema = weights[0]
        for w in weights[1:]:
            ema = EMA_ALPHA * w + (1.0 - EMA_ALPHA) * ema
        assert _compute_ema(history) == pytest.approx(ema)

    def test_constant_weights_ema_equals_weight(self):
        history = _make_history([80.0] * 14)
        assert _compute_ema(history) == pytest.approx(80.0)

    def test_empty_history_raises(self):
        with pytest.raises(ValueError, match="must not be empty"):
            _compute_ema([])


# ---------------------------------------------------------------------------
# Extreme fluctuation filtering
# ---------------------------------------------------------------------------

class TestFluctuationFilter:
    def test_no_fluctuations_keeps_all(self):
        history = _make_history([80.0, 80.5, 81.0, 80.8])
        assert len(_filter_extreme_fluctuations(history)) == 4

    def test_extreme_spike_excluded(self):
        # 80 -> 85 is a 5kg jump, should be excluded
        history = _make_history([80.0, 85.0, 80.2])
        filtered = _filter_extreme_fluctuations(history)
        weights = [w for _, w in filtered]
        assert 85.0 not in weights
        assert len(filtered) == 2

    def test_single_entry_kept(self):
        history = _make_history([80.0])
        assert _filter_extreme_fluctuations(history) == history

    def test_empty_history(self):
        assert _filter_extreme_fluctuations([]) == []


# ---------------------------------------------------------------------------
# Step 5: Macros
# ---------------------------------------------------------------------------

class TestMacros:
    def test_cutting_macros(self):
        protein_g, fat_g, carbs_g = _compute_macros(80.0, 2000.0, GoalType.CUTTING)
        assert protein_g == pytest.approx(80.0 * 2.2)  # 176g
        assert fat_g == pytest.approx(2000.0 * 0.25 / 9.0)  # ~55.56g
        # carbs = (2000 - 176*4 - 55.56*9) / 4
        expected_carbs = (2000.0 - 176.0 * 4.0 - fat_g * 9.0) / 4.0
        assert carbs_g == pytest.approx(expected_carbs)

    def test_negative_carbs_floored(self):
        # Very low calories with heavy person → carbs would go negative
        _, _, carbs_g = _compute_macros(120.0, 1200.0, GoalType.CUTTING)
        assert carbs_g >= MIN_CARBS_G

    def test_bulking_protein_multiplier(self):
        protein_g, _, _ = _compute_macros(80.0, 3000.0, GoalType.BULKING)
        assert protein_g == pytest.approx(80.0 * 2.0)


# ---------------------------------------------------------------------------
# Full compute_snapshot integration
# ---------------------------------------------------------------------------

class TestComputeSnapshot:
    def test_determinism(self):
        """Identical inputs must produce identical outputs."""
        inp = _default_input()
        out1 = compute_snapshot(inp)
        out2 = compute_snapshot(inp)
        assert out1 == out2

    def test_returns_adaptive_output(self):
        out = compute_snapshot(_default_input())
        assert isinstance(out, AdaptiveOutput)

    def test_minimum_calories_enforced(self):
        # Extreme cutting with very low TDEE
        inp = _default_input(
            weight_kg=50.0,
            height_cm=150.0,
            age_years=60,
            sex="female",
            activity_level=ActivityLevel.SEDENTARY,
            goal_type=GoalType.CUTTING,
            bodyweight_history=_make_history([50.0] * 14),
        )
        out = compute_snapshot(inp)
        assert out.target_calories >= MIN_TARGET_CALORIES

    def test_carbs_minimum_enforced(self):
        out = compute_snapshot(_default_input())
        assert out.target_carbs_g >= MIN_CARBS_G

    def test_adjustment_clamped(self):
        out = compute_snapshot(_default_input())
        assert ADJUSTMENT_CLAMP_MIN <= out.adjustment_factor <= ADJUSTMENT_CLAMP_MAX

    def test_cutting_fewer_calories_than_maintaining(self):
        base = dict(
            weight_kg=80.0,
            height_cm=178.0,
            age_years=30,
            sex="male",
            activity_level=ActivityLevel.MODERATE,
            goal_rate_per_week=0.0,
            bodyweight_history=_make_history([80.0] * 14),
            training_load_score=50.0,
        )
        cutting = compute_snapshot(AdaptiveInput(**base, goal_type=GoalType.CUTTING))
        maintaining = compute_snapshot(AdaptiveInput(**base, goal_type=GoalType.MAINTAINING))
        assert cutting.target_calories < maintaining.target_calories

    def test_bulking_more_calories_than_maintaining(self):
        base = dict(
            weight_kg=80.0,
            height_cm=178.0,
            age_years=30,
            sex="male",
            activity_level=ActivityLevel.MODERATE,
            goal_rate_per_week=0.0,
            bodyweight_history=_make_history([80.0] * 14),
            training_load_score=50.0,
        )
        bulking = compute_snapshot(AdaptiveInput(**base, goal_type=GoalType.BULKING))
        maintaining = compute_snapshot(AdaptiveInput(**base, goal_type=GoalType.MAINTAINING))
        assert bulking.target_calories > maintaining.target_calories

    def test_limited_data_uses_simple_average(self):
        """With < 7 days of data, EMA should be a simple average."""
        weights = [80.0, 80.5, 80.2]
        inp = _default_input(bodyweight_history=_make_history(weights))
        out = compute_snapshot(inp)
        expected_avg = sum(weights) / len(weights)
        assert out.ema_current == pytest.approx(round(expected_avg, 4))

    def test_extreme_fluctuation_excluded(self):
        """A >2kg spike should be excluded from EMA."""
        weights = [80.0] * 7 + [90.0] + [80.0] * 6  # spike at day 8
        inp = _default_input(bodyweight_history=_make_history(weights))
        out = compute_snapshot(inp)
        # EMA should be close to 80, not pulled toward 90
        assert abs(out.ema_current - 80.0) < 1.0

    def test_known_male_calculation(self):
        """Verify a fully worked example for a male cutting."""
        weights = [80.0] * 14
        inp = AdaptiveInput(
            weight_kg=80.0,
            height_cm=178.0,
            age_years=30,
            sex="male",
            activity_level=ActivityLevel.MODERATE,
            goal_type=GoalType.CUTTING,
            goal_rate_per_week=-0.5,
            bodyweight_history=_make_history(weights),
            training_load_score=50.0,
        )
        out = compute_snapshot(inp)

        # BMR = 10*80 + 6.25*178 - 5*30 + 5 = 1767.5
        # TDEE = 1767.5 * 1.55 = 2739.625
        # EMA = 80.0 (constant weights)
        # EMA 7 days ago = 80.0
        # weekly_weight_change = 0.0
        # adjustment = (-0.5 - 0.0) * 500 = -250, clamped → -250
        # target = 2739.625 + (-500) + (-250) = 1989.625
        # protein = 80 * 2.2 = 176g
        # fat = 1989.625 * 0.25 / 9 ≈ 55.27g
        # carbs = (1989.625 - 176*4 - 55.27*9) / 4

        assert out.ema_current == pytest.approx(80.0, abs=0.01)
        assert out.adjustment_factor == pytest.approx(-250.0, abs=0.01)
        assert out.target_protein_g == pytest.approx(176.0, abs=0.01)
        assert out.target_calories >= MIN_TARGET_CALORIES
