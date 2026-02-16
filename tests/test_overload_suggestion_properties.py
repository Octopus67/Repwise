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
