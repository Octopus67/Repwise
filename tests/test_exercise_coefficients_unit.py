"""Unit tests for exercise_coefficients functions.

Tests get_muscle_coefficients and get_exercise_coefficient.
"""

from __future__ import annotations

from src.modules.training.exercise_coefficients import (
    get_muscle_coefficients,
    get_exercise_coefficient,
)


class TestGetMuscleCoefficients:
    """Tests for muscle coefficient mapping."""

    def test_primary_gets_1_0(self):
        """Primary muscle gets coefficient 1.0."""
        result = get_muscle_coefficients("bench press", "chest", None)
        assert result == {"chest": 1.0}

    def test_secondary_gets_0_5(self):
        """Secondary muscles get coefficient 0.5."""
        result = get_muscle_coefficients("bench press", "chest", ["triceps", "shoulders"])
        expected = {"chest": 1.0, "triceps": 0.5, "shoulders": 0.5}
        assert result == expected

    def test_unlisted_muscle_returns_zero(self):
        """Unlisted muscles are not in the result dict."""
        result = get_muscle_coefficients("bench press", "chest", ["triceps"])
        assert "biceps" not in result

    def test_no_secondary_returns_primary_only(self):
        """No secondary muscles returns only primary."""
        result = get_muscle_coefficients("bench press", "chest", None)
        assert result == {"chest": 1.0}

    def test_fallback_to_exercise_mapping(self):
        """Falls back to exercise mapping when no muscles specified."""
        result = get_muscle_coefficients("bench press", "", None)
        # bench press maps to "chest" in exercise_mapping
        assert result == {"chest": 1.0}


class TestGetExerciseCoefficient:
    """Tests for single muscle coefficient lookup."""

    def test_coefficient_for_direct_muscle(self):
        """Primary muscle returns 1.0."""
        result = get_exercise_coefficient("bench press", "chest", "chest", None)
        assert result == 1.0

    def test_coefficient_for_fractional_muscle(self):
        """Secondary muscle returns 0.5."""
        result = get_exercise_coefficient("bench press", "triceps", "chest", ["triceps"])
        assert result == 0.5

    def test_coefficient_for_unrelated_muscle(self):
        """Unrelated muscle returns 0.0."""
        result = get_exercise_coefficient("bench press", "biceps", "chest", ["triceps"])
        assert result == 0.0