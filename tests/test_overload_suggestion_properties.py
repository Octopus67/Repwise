"""Tests for the progressive overload suggestion algorithm.

Tests the pure ``compute_suggestion`` function directly — no DB access needed.
"""

from __future__ import annotations

import pytest

from src.modules.training.overload_service import (
    _DEFAULT_RPE,
    _SessionSnapshot,
    compute_suggestion,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_snapshots(
    count: int,
    weight_kg: float = 80.0,
    reps: int = 8,
    avg_rpe: float = 7.0,
) -> list[_SessionSnapshot]:
    """Create *count* identical session snapshots."""
    return [
        _SessionSnapshot(weight_kg=weight_kg, reps=reps, avg_rpe=avg_rpe)
        for _ in range(count)
    ]


# ---------------------------------------------------------------------------
# (a) Returns None when < 3 sessions exist
# ---------------------------------------------------------------------------


class TestInsufficientData:
    def test_zero_sessions(self):
        result = compute_suggestion("Barbell Bench Press", [], equipment="barbell")
        assert result is None

    def test_one_session(self):
        result = compute_suggestion(
            "Barbell Bench Press",
            _make_snapshots(1),
            equipment="barbell",
        )
        assert result is None

    def test_two_sessions(self):
        result = compute_suggestion(
            "Barbell Bench Press",
            _make_snapshots(2),
            equipment="barbell",
        )
        assert result is None


# ---------------------------------------------------------------------------
# (b) Suggests weight increase when avg RPE < 7
# ---------------------------------------------------------------------------


class TestWeightIncrease:
    def test_low_rpe_suggests_weight_increase(self):
        snaps = _make_snapshots(3, weight_kg=80.0, reps=8, avg_rpe=6.0)
        result = compute_suggestion("Barbell Bench Press", snaps, equipment="barbell")
        assert result is not None
        assert result.suggested_weight_kg == 82.5  # +2.5 for barbell
        assert result.suggested_reps == 8
        assert "increase weight" in result.reasoning.lower()

    def test_very_low_rpe(self):
        snaps = _make_snapshots(4, weight_kg=40.0, reps=10, avg_rpe=5.0)
        result = compute_suggestion("Dumbbell Curl", snaps, equipment="dumbbell")
        assert result is not None
        assert result.suggested_weight_kg == 41.0  # +1 for dumbbell
        assert result.suggested_reps == 10


# ---------------------------------------------------------------------------
# (c) Suggests rep increase when avg RPE 7-9
# ---------------------------------------------------------------------------


class TestRepIncrease:
    def test_moderate_rpe_suggests_rep_increase(self):
        snaps = _make_snapshots(3, weight_kg=80.0, reps=8, avg_rpe=8.0)
        result = compute_suggestion("Barbell Bench Press", snaps, equipment="barbell")
        assert result is not None
        assert result.suggested_weight_kg == 80.0
        assert result.suggested_reps == 9  # +1 rep
        assert "rep" in result.reasoning.lower()

    def test_rpe_exactly_7(self):
        snaps = _make_snapshots(3, weight_kg=60.0, reps=10, avg_rpe=7.0)
        result = compute_suggestion("Squat", snaps, equipment="barbell")
        assert result is not None
        assert result.suggested_weight_kg == 60.0
        assert result.suggested_reps == 11

    def test_rpe_exactly_9(self):
        snaps = _make_snapshots(3, weight_kg=60.0, reps=10, avg_rpe=9.0)
        result = compute_suggestion("Squat", snaps, equipment="barbell")
        assert result is not None
        assert result.suggested_weight_kg == 60.0
        assert result.suggested_reps == 11


# ---------------------------------------------------------------------------
# (d) Suggests maintain when avg RPE > 9
# ---------------------------------------------------------------------------


class TestMaintain:
    def test_high_rpe_suggests_maintain(self):
        snaps = _make_snapshots(3, weight_kg=100.0, reps=5, avg_rpe=9.5)
        result = compute_suggestion("Deadlift", snaps, equipment="barbell")
        assert result is not None
        assert result.suggested_weight_kg == 100.0
        assert result.suggested_reps == 5
        assert "maintain" in result.reasoning.lower()

    def test_rpe_10(self):
        snaps = _make_snapshots(4, weight_kg=80.0, reps=3, avg_rpe=10.0)
        result = compute_suggestion("Bench Press", snaps, equipment="barbell")
        assert result is not None
        assert result.suggested_weight_kg == 80.0
        assert result.suggested_reps == 3


# ---------------------------------------------------------------------------
# (e) Returns correct equipment-specific increment
# ---------------------------------------------------------------------------


class TestEquipmentIncrement:
    def test_barbell_increment_2_5(self):
        snaps = _make_snapshots(3, weight_kg=60.0, reps=8, avg_rpe=6.0)
        result = compute_suggestion("Barbell Bench Press", snaps, equipment="barbell")
        assert result is not None
        assert result.suggested_weight_kg == 62.5

    def test_dumbbell_increment_1(self):
        snaps = _make_snapshots(3, weight_kg=20.0, reps=10, avg_rpe=6.0)
        result = compute_suggestion("Dumbbell Curl", snaps, equipment="dumbbell")
        assert result is not None
        assert result.suggested_weight_kg == 21.0

    def test_cable_increment_1(self):
        snaps = _make_snapshots(3, weight_kg=30.0, reps=12, avg_rpe=5.5)
        result = compute_suggestion("Cable Crossover", snaps, equipment="cable")
        assert result is not None
        assert result.suggested_weight_kg == 31.0

    def test_machine_defaults_to_2_5(self):
        snaps = _make_snapshots(3, weight_kg=50.0, reps=10, avg_rpe=6.0)
        result = compute_suggestion("Leg Press", snaps, equipment="machine")
        assert result is not None
        assert result.suggested_weight_kg == 52.5


# ---------------------------------------------------------------------------
# (f) Confidence is "high" when 5+ sessions, "medium" when 3-4
# ---------------------------------------------------------------------------


class TestConfidence:
    def test_three_sessions_medium(self):
        snaps = _make_snapshots(3, avg_rpe=8.0)
        result = compute_suggestion("Squat", snaps, equipment="barbell")
        assert result is not None
        assert result.confidence == "medium"

    def test_four_sessions_medium(self):
        snaps = _make_snapshots(4, avg_rpe=8.0)
        result = compute_suggestion("Squat", snaps, equipment="barbell")
        assert result is not None
        assert result.confidence == "medium"

    def test_five_sessions_high(self):
        snaps = _make_snapshots(5, avg_rpe=8.0)
        result = compute_suggestion("Squat", snaps, equipment="barbell")
        assert result is not None
        assert result.confidence == "high"

    def test_six_sessions_high(self):
        """More than 5 still uses only 5 but confidence stays high."""
        snaps = _make_snapshots(6, avg_rpe=8.0)
        result = compute_suggestion("Squat", snaps, equipment="barbell")
        assert result is not None
        assert result.confidence == "high"


# ---------------------------------------------------------------------------
# (g) Handles exercises with no RPE data (treat as RPE 7.5 default)
# ---------------------------------------------------------------------------


class TestNoRPEData:
    def test_default_rpe_is_7_5(self):
        """When avg_rpe equals the default (7.5), should suggest +1 rep."""
        snaps = _make_snapshots(3, weight_kg=60.0, reps=8, avg_rpe=_DEFAULT_RPE)
        result = compute_suggestion("Squat", snaps, equipment="barbell")
        assert result is not None
        # 7.5 is in the 7-9 range → rep increase
        assert result.suggested_weight_kg == 60.0
        assert result.suggested_reps == 9

    def test_default_rpe_value(self):
        """Verify the default RPE constant is 7.5."""
        assert _DEFAULT_RPE == 7.5


# ---------------------------------------------------------------------------
# Hypothesis property-based tests
# ---------------------------------------------------------------------------

from hypothesis import given, settings as h_settings, strategies as st

# Shared Hypothesis settings — minimum 100 examples per property
_hypothesis_settings = h_settings(max_examples=100, deadline=None)


# ---------------------------------------------------------------------------
# Property 7: Overload suggestion weight is always non-negative
# **Validates: Requirements 4.3**
# ---------------------------------------------------------------------------


class TestProperty7NonNegativeWeight:
    """Property 7 — suggested_weight_kg >= 0 for any valid snapshots."""

    @_hypothesis_settings
    @given(
        snapshots=st.lists(
            st.builds(
                _SessionSnapshot,
                weight_kg=st.floats(0, 500),
                reps=st.integers(1, 50),
                avg_rpe=st.floats(1, 10),
            ),
            min_size=3,
            max_size=5,
        ),
    )
    def test_suggested_weight_is_non_negative(self, snapshots):
        """**Validates: Requirements 4.3**

        For any list of 3-5 session snapshots with non-negative weights,
        compute_suggestion must return a suggestion with suggested_weight_kg >= 0.
        """
        result = compute_suggestion("Test Exercise", snapshots, equipment="barbell")
        assert result is not None, "Should return a suggestion for 3+ snapshots"
        assert result.suggested_weight_kg >= 0, (
            f"suggested_weight_kg must be non-negative, got {result.suggested_weight_kg}"
        )

    @_hypothesis_settings
    @given(
        snapshots=st.lists(
            st.builds(
                _SessionSnapshot,
                weight_kg=st.floats(0, 500),
                reps=st.integers(1, 50),
                avg_rpe=st.floats(1, 10),
            ),
            min_size=3,
            max_size=5,
        ),
        equipment=st.sampled_from(["barbell", "dumbbell", "cable", "machine", "other"]),
    )
    def test_suggested_weight_non_negative_all_equipment(self, snapshots, equipment):
        """**Validates: Requirements 4.3**

        Non-negative weight holds across all equipment types.
        """
        result = compute_suggestion("Test Exercise", snapshots, equipment=equipment)
        assert result is not None
        assert result.suggested_weight_kg >= 0


# ---------------------------------------------------------------------------
# Property 8: Overload suggestion confidence is always valid
# **Validates: Requirements 4.5**
# ---------------------------------------------------------------------------


class TestProperty8ValidConfidence:
    """Property 8 — confidence is always one of high, medium, low."""

    @_hypothesis_settings
    @given(
        snapshots=st.lists(
            st.builds(
                _SessionSnapshot,
                weight_kg=st.floats(0, 500),
                reps=st.integers(1, 50),
                avg_rpe=st.floats(1, 10),
            ),
            min_size=3,
            max_size=5,
        ),
    )
    def test_confidence_is_valid_enum(self, snapshots):
        """**Validates: Requirements 4.5**

        For any valid suggestion, confidence must be one of high, medium, or low.
        """
        result = compute_suggestion("Test Exercise", snapshots, equipment="barbell")
        assert result is not None
        assert result.confidence in {"high", "medium", "low"}, (
            f"confidence must be high/medium/low, got '{result.confidence}'"
        )

    @_hypothesis_settings
    @given(
        snapshots=st.lists(
            st.builds(
                _SessionSnapshot,
                weight_kg=st.floats(0, 500),
                reps=st.integers(1, 50),
                avg_rpe=st.floats(1, 10),
            ),
            min_size=3,
            max_size=5,
        ),
        equipment=st.sampled_from(["barbell", "dumbbell", "cable", "machine", "other"]),
    )
    def test_confidence_valid_all_equipment(self, snapshots, equipment):
        """**Validates: Requirements 4.5**

        Valid confidence holds across all equipment types.
        """
        result = compute_suggestion("Test Exercise", snapshots, equipment=equipment)
        assert result is not None
        assert result.confidence in {"high", "medium", "low"}
