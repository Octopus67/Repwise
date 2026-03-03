"""Unit tests for wns_engine pure computation functions.

Tests rir_from_rpe, stimulating_reps_per_set, diminishing_returns,
atrophy_between_sessions, compute_session_muscle_stimulus.
"""

from __future__ import annotations

import pytest

from src.modules.training.wns_engine import (
    rir_from_rpe,
    stimulating_reps_per_set,
    diminishing_returns,
    atrophy_between_sessions,
    compute_session_muscle_stimulus,
)


# ─── rir_from_rpe ────────────────────────────────────────────────────────────


class TestRirFromRpe:
    """Tests for RPE to RIR conversion."""

    def test_rpe_10_returns_0(self):
        assert rir_from_rpe(10.0) == 0.0

    def test_rpe_8_returns_2(self):
        assert rir_from_rpe(8.0) == 2.0

    def test_rpe_6_returns_4(self):
        assert rir_from_rpe(6.0) == 4.0

    def test_rpe_none_returns_default(self):
        assert rir_from_rpe(None) == 3.0  # DEFAULT_RIR = 3.0 (RPE 7)

    def test_rpe_clamped_above_10(self):
        """RPE > 10 is clamped to 10, so RIR = 0."""
        assert rir_from_rpe(12.0) == 0.0

    def test_rpe_clamped_below_1(self):
        """RPE < 1 is clamped to 1, so RIR = 9."""
        assert rir_from_rpe(-5.0) == 9.0


# ─── stimulating_reps_per_set ────────────────────────────────────────────────


class TestStimulatingRepsPerSet:
    """Tests for stimulating reps calculation per set."""

    def test_at_failure_returns_max_stim_reps(self):
        """RIR = 0 (at failure) returns min(reps, MAX_STIM_REPS)."""
        assert stimulating_reps_per_set(10, 0.0, 0.75) == 5.0

    def test_rir_1_returns_4(self):
        """RIR = 1 returns min(4, reps)."""
        assert stimulating_reps_per_set(10, 1.0, 0.75) == 4.0

    def test_rir_2_returns_3(self):
        """RIR = 2 returns min(3, reps)."""
        assert stimulating_reps_per_set(10, 2.0, 0.75) == 3.0

    def test_rir_3_returns_2(self):
        """RIR = 3 returns min(2, reps)."""
        assert stimulating_reps_per_set(10, 3.0, 0.75) == 2.0

    def test_rir_4_returns_zero(self):
        """RIR >= 4 returns 0."""
        assert stimulating_reps_per_set(10, 4.0, 0.75) == 0.0

    def test_rir_5_returns_zero(self):
        """RIR >= 4 returns 0."""
        assert stimulating_reps_per_set(10, 5.0, 0.75) == 0.0

    def test_heavy_load_all_reps_stimulating(self):
        """Intensity >= 85% makes all reps stimulating."""
        assert stimulating_reps_per_set(3, 2.0, 0.90) == 3.0

    def test_heavy_load_capped_at_max(self):
        """Heavy load capped at MAX_STIM_REPS."""
        assert stimulating_reps_per_set(8, 0.0, 0.90) == 5.0

    def test_low_reps_capped_by_actual_reps(self):
        """Low rep count caps the result."""
        assert stimulating_reps_per_set(2, 0.0, 0.75) == 2.0

    def test_zero_reps_returns_zero(self):
        """Zero reps returns zero stimulus."""
        assert stimulating_reps_per_set(0, 0.0, 0.75) == 0.0

    def test_none_rir_uses_default(self):
        """None RIR uses DEFAULT_RIR (3.0 = RPE 7) → min(2, reps)."""
        assert stimulating_reps_per_set(10, None, 0.75) == 2.0

    def test_none_intensity_uses_default(self):
        """None intensity uses 0.75 default, RIR=0 → min(5, reps)."""
        assert stimulating_reps_per_set(10, 0.0, None) == 5.0


# ─── diminishing_returns ─────────────────────────────────────────────────────


class TestDiminishingReturns:
    """Tests for diminishing returns calculation."""

    def test_empty_list_returns_zero(self):
        assert diminishing_returns([]) == 0.0

    def test_single_set(self):
        """Single set has no diminishing returns."""
        assert diminishing_returns([5.0]) == 5.0

    def test_two_sets_less_than_double(self):
        """Two sets should be less than double one set due to diminishing returns."""
        result = diminishing_returns([5.0, 5.0])
        assert result < 10.0
        assert result > 5.0

    def test_six_sets_approx_double_one_set(self):
        """Six identical sets should produce ~2x stimulus of one set (Schoenfeld)."""
        single = diminishing_returns([5.0])
        six = diminishing_returns([5.0, 5.0, 5.0, 5.0, 5.0, 5.0])
        ratio = six / single
        assert 1.8 < ratio < 2.2, f"Expected ~2.0x, got {ratio:.2f}x"

    def test_order_matters(self):
        """Order of sets affects the result."""
        result1 = diminishing_returns([5.0, 1.0])
        result2 = diminishing_returns([1.0, 5.0])
        assert result1 != result2


# ─── atrophy_between_sessions ────────────────────────────────────────────────


class TestAtrophyBetweenSessions:
    """Tests for atrophy calculation between sessions."""

    def test_no_gap_returns_zero(self):
        """No gap between sessions means no atrophy."""
        assert atrophy_between_sessions(0.0) == 0.0

    def test_gap_within_stimulus_returns_zero(self):
        """Gap within stimulus duration means no atrophy."""
        assert atrophy_between_sessions(1.5, stimulus_duration_days=2.0) == 0.0

    def test_gap_beyond_stimulus(self):
        """Gap beyond stimulus duration causes atrophy."""
        result = atrophy_between_sessions(5.0, stimulus_duration_days=2.0, maintenance_sets_per_week=3.0)
        # atrophy_days = 5.0 - 2.0 = 3.0
        # daily_rate = 3.0 / 7.0 ≈ 0.4286
        # atrophy = 3.0 * 0.4286 ≈ 1.286
        expected = 3.0 * (3.0 / 7.0)
        assert abs(result - expected) < 0.001

    def test_zero_maintenance_returns_zero(self):
        """Zero maintenance sets means no atrophy."""
        assert atrophy_between_sessions(10.0, maintenance_sets_per_week=0.0) == 0.0

    def test_large_gap(self):
        """Large gap causes proportional atrophy."""
        result = atrophy_between_sessions(7.0, stimulus_duration_days=2.0, maintenance_sets_per_week=3.0)
        # atrophy_days = 7.0 - 2.0 = 5.0
        # daily_rate = 3.0 / 7.0 ≈ 0.4286
        # atrophy = 5.0 * 0.4286 ≈ 2.143
        expected = 5.0 * (3.0 / 7.0)
        assert abs(result - expected) < 0.001


# ─── compute_session_muscle_stimulus ─────────────────────────────────────────


class TestComputeSessionMuscleStimulus:
    """Tests for session muscle stimulus computation."""

    def test_empty_sets_returns_zero(self):
        """Empty sets list returns zero stimulus."""
        result = compute_session_muscle_stimulus([], "chest", {})
        assert result == 0.0

    def test_warmup_sets_excluded(self):
        """Warm-up sets are excluded from stimulus calculation."""
        sets_data = [
            {"exercise_id": "bench_press", "reps": 10, "rir": 0.0, "set_type": "warm-up"},
            {"exercise_id": "bench_press", "reps": 8, "rir": 1.0, "set_type": "normal"},
        ]
        coefficients = {"bench_press": {"chest": 1.0}}
        result = compute_session_muscle_stimulus(sets_data, "chest", coefficients)
        # Only the normal set should count: min(4, 8) * 1.0 = 4.0
        assert result == 4.0

    def test_direct_coefficient_applied(self):
        """Direct muscle coefficient is applied correctly."""
        sets_data = [
            {"exercise_id": "bench_press", "reps": 10, "rir": 0.0},
        ]
        coefficients = {"bench_press": {"chest": 1.0}}
        result = compute_session_muscle_stimulus(sets_data, "chest", coefficients)
        # min(5, 10) * 1.0 = 5.0
        assert result == 5.0

    def test_fractional_coefficient_applied(self):
        """Fractional muscle coefficient is applied correctly."""
        sets_data = [
            {"exercise_id": "bench_press", "reps": 10, "rir": 0.0},
        ]
        coefficients = {"bench_press": {"triceps": 0.5}}
        result = compute_session_muscle_stimulus(sets_data, "triceps", coefficients)
        # min(5, 10) * 0.5 = 2.5
        assert result == 2.5