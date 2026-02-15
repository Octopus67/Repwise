"""Property-based tests for the e1RM Calculator.

Tests Properties 1–3 from the Strength Standards design document using
Hypothesis, exercised against pure functions with no database dependencies.
"""

from __future__ import annotations

import pytest
from hypothesis import given, settings as h_settings, strategies as st

from src.modules.training.e1rm_calculator import (
    E1RMResult,
    MAX_REPS,
    best_e1rm_for_exercise,
    compute_e1rm,
)

_pbt_settings = h_settings(max_examples=100, deadline=None)

# Strategies
_weight_st = st.floats(min_value=0.5, max_value=500.0, allow_nan=False, allow_infinity=False)
_reps_normal_st = st.integers(min_value=1, max_value=MAX_REPS)


class TestProperty1FormulaCorrectness:
    """Property 1: e1RM Formula Correctness.

    For any weight_kg > 0 and reps in [1, 30], verify Epley, Brzycki,
    Lombardi formulas and primary == Epley.

    Validates: Requirements 1.1, 1.2, 1.3, 1.7
    """

    @_pbt_settings
    @given(weight_kg=_weight_st, reps=_reps_normal_st)
    def test_epley_formula(self, weight_kg: float, reps: int):
        result = compute_e1rm(weight_kg, reps)
        if reps == 1:
            assert result.epley == pytest.approx(weight_kg)
        else:
            expected = weight_kg * (1 + reps / 30)
            assert result.epley == pytest.approx(expected, rel=1e-9)

    @_pbt_settings
    @given(weight_kg=_weight_st, reps=st.integers(min_value=2, max_value=MAX_REPS))
    def test_brzycki_formula(self, weight_kg: float, reps: int):
        result = compute_e1rm(weight_kg, reps)
        expected = weight_kg * 36 / (37 - reps)
        assert result.brzycki == pytest.approx(expected, rel=1e-9)

    @_pbt_settings
    @given(weight_kg=_weight_st, reps=st.integers(min_value=2, max_value=MAX_REPS))
    def test_lombardi_formula(self, weight_kg: float, reps: int):
        result = compute_e1rm(weight_kg, reps)
        expected = weight_kg * (reps ** 0.10)
        assert result.lombardi == pytest.approx(expected, rel=1e-9)

    @_pbt_settings
    @given(weight_kg=_weight_st, reps=_reps_normal_st)
    def test_primary_equals_epley(self, weight_kg: float, reps: int):
        result = compute_e1rm(weight_kg, reps)
        assert result.primary == result.epley


class TestProperty2LowConfidenceFlag:
    """Property 2: Low Confidence Flag.

    With reps capped at MAX_REPS, low_confidence is always False for valid inputs.
    Reps > MAX_REPS now raise ValueError.

    Validates: Requirements 1.6
    """

    @_pbt_settings
    @given(weight_kg=_weight_st, reps=_reps_normal_st)
    def test_normal_reps_not_low_confidence(self, weight_kg: float, reps: int):
        result = compute_e1rm(weight_kg, reps)
        assert result.low_confidence is False

    @_pbt_settings
    @given(weight_kg=_weight_st, reps=st.integers(min_value=31, max_value=60))
    def test_high_reps_raises_value_error(self, weight_kg: float, reps: int):
        with pytest.raises(ValueError, match="reps must be"):
            compute_e1rm(weight_kg, reps)


class TestProperty3BestSetMaximality:
    """Property 3: Best Set Selection Maximality.

    For any non-empty list of valid sets, best_e1rm_for_exercise returns
    the max Epley e1RM.

    Validates: Requirements 1.8
    """

    @_pbt_settings
    @given(
        sets=st.lists(
            st.fixed_dictionaries({
                "weight_kg": st.floats(min_value=0.5, max_value=300.0, allow_nan=False, allow_infinity=False),
                "reps": st.integers(min_value=1, max_value=MAX_REPS),
            }),
            min_size=1,
            max_size=10,
        )
    )
    def test_best_is_max_epley(self, sets: list):
        result = best_e1rm_for_exercise(sets)
        assert result is not None

        # Manually compute max Epley
        max_epley = max(compute_e1rm(s["weight_kg"], s["reps"]).epley for s in sets)
        assert result.epley == pytest.approx(max_epley, rel=1e-9)


class TestEdgeCases:
    """Edge case unit tests for e1RM calculator."""

    def test_reps_zero(self):
        r = compute_e1rm(100.0, 0)
        assert r.epley == 0.0 and r.brzycki == 0.0 and r.lombardi == 0.0

    def test_weight_zero(self):
        r = compute_e1rm(0.0, 5)
        assert r.epley == 0.0 and r.primary == 0.0

    def test_reps_one(self):
        r = compute_e1rm(100.0, 1)
        assert r.epley == 100.0 and r.brzycki == 100.0 and r.lombardi == 100.0

    def test_best_e1rm_empty_sets(self):
        assert best_e1rm_for_exercise([]) is None

    def test_best_e1rm_all_invalid(self):
        sets = [{"weight_kg": 0, "reps": 5}, {"weight_kg": 50, "reps": 0}]
        assert best_e1rm_for_exercise(sets) is None


class TestInputValidation:
    """Tests for input validation — negative values, out-of-range reps."""

    def test_negative_weight_raises(self):
        with pytest.raises(ValueError, match="weight_kg must be >= 0"):
            compute_e1rm(-100.0, 5)

    def test_negative_reps_raises(self):
        with pytest.raises(ValueError, match="reps must be >= 0"):
            compute_e1rm(100.0, -1)

    def test_reps_above_max_raises(self):
        with pytest.raises(ValueError, match="reps must be <= 30"):
            compute_e1rm(100.0, 31)

    def test_reps_exactly_max(self):
        r = compute_e1rm(100.0, MAX_REPS)
        expected_epley = 100.0 * (1 + MAX_REPS / 30)
        assert r.epley == pytest.approx(expected_epley)

    def test_reps_37_now_rejected(self):
        """Reps=37 previously had a Brzycki fallback; now it's rejected."""
        with pytest.raises(ValueError, match="reps must be <= 30"):
            compute_e1rm(100.0, 37)

    def test_very_heavy_weight(self):
        """500 kg is valid — no upper bound on weight."""
        r = compute_e1rm(500.0, 5)
        assert r.epley > 500.0
        assert r.primary == r.epley

    def test_best_e1rm_skips_out_of_range_reps(self):
        """Sets with reps > MAX_REPS are silently skipped."""
        sets = [
            {"weight_kg": 100, "reps": 50},  # skipped
            {"weight_kg": 80, "reps": 10},   # valid
        ]
        result = best_e1rm_for_exercise(sets)
        assert result is not None
        assert result.epley == pytest.approx(80.0 * (1 + 10 / 30))

    def test_best_e1rm_skips_negative_weight(self):
        sets = [
            {"weight_kg": -50, "reps": 5},  # skipped
            {"weight_kg": 60, "reps": 5},   # valid
        ]
        result = best_e1rm_for_exercise(sets)
        assert result is not None
        assert result.epley == pytest.approx(60.0 * (1 + 5 / 30))

    @_pbt_settings
    @given(
        weight_kg=st.floats(min_value=-1000, max_value=-0.01, allow_nan=False, allow_infinity=False),
        reps=st.integers(min_value=1, max_value=MAX_REPS),
    )
    def test_any_negative_weight_raises(self, weight_kg: float, reps: int):
        with pytest.raises(ValueError):
            compute_e1rm(weight_kg, reps)

    @_pbt_settings
    @given(
        weight_kg=_weight_st,
        reps=st.integers(min_value=-100, max_value=-1),
    )
    def test_any_negative_reps_raises(self, weight_kg: float, reps: int):
        with pytest.raises(ValueError):
            compute_e1rm(weight_kg, reps)


class TestBrzyckiSafety:
    """Verify Brzycki formula never produces negative or infinite values."""

    @_pbt_settings
    @given(weight_kg=_weight_st, reps=st.integers(min_value=2, max_value=MAX_REPS))
    def test_brzycki_always_positive(self, weight_kg: float, reps: int):
        result = compute_e1rm(weight_kg, reps)
        assert result.brzycki > 0

    @_pbt_settings
    @given(weight_kg=_weight_st, reps=st.integers(min_value=2, max_value=MAX_REPS))
    def test_brzycki_always_finite(self, weight_kg: float, reps: int):
        result = compute_e1rm(weight_kg, reps)
        assert result.brzycki != float("inf")
        assert result.brzycki != float("-inf")
