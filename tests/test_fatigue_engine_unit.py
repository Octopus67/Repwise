"""Unit tests for fatigue_engine.py — pure computation functions.

Covers: e1RM calculation, regression detection, fatigue scoring,
deload suggestions, color mapping, and edge cases.
"""

import math
from datetime import date, timedelta

import pytest

from src.modules.training.fatigue_engine import (
    DeloadSuggestion,
    ExerciseE1RM,
    FatigueConfig,
    FatigueScoreResult,
    MRV_SETS_PER_WEEK,
    RegressionSignal,
    SessionExerciseData,
    SetData,
    compute_best_e1rm_per_session,
    compute_e1rm,
    compute_fatigue_score,
    compute_nutrition_compliance,
    detect_regressions,
    generate_suggestions,
    get_fatigue_color,
)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_session(name: str, day_offset: int, weight: float, reps: int) -> SessionExerciseData:
    """Create a SessionExerciseData with a single set, offset days from today."""
    return SessionExerciseData(
        session_date=date.today() - timedelta(days=day_offset),
        exercise_name=name,
        sets=[SetData(reps=reps, weight_kg=weight)],
    )


def _make_declining_sessions(name: str, count: int, start_weight: float = 100.0, drop: float = 5.0):
    """Create a series of sessions with declining weights."""
    sessions = []
    for i in range(count):
        w = start_weight - (i * drop)
        sessions.append(_make_session(name, count - i, max(w, 10.0), 8))
    return sessions


# ═══════════════════════════════════════════════════════════════════════════════
# 1. compute_e1rm
# ═══════════════════════════════════════════════════════════════════════════════

class TestComputeE1RM:
    def test_basic_epley(self):
        # 100 kg × (1 + 10/30) = 133.33
        result = compute_e1rm(100.0, 10)
        assert abs(result - 133.333) < 0.01

    def test_single_rep(self):
        # 100 × (1 + 1/30) ≈ 103.33
        result = compute_e1rm(100.0, 1)
        assert abs(result - 103.333) < 0.01

    def test_zero_weight_returns_zero(self):
        assert compute_e1rm(0.0, 10) == 0.0

    def test_zero_reps_returns_zero(self):
        assert compute_e1rm(100.0, 0) == 0.0

    def test_negative_weight_returns_zero(self):
        assert compute_e1rm(-50.0, 10) == 0.0

    def test_negative_reps_returns_zero(self):
        assert compute_e1rm(100.0, -5) == 0.0

    def test_nan_weight_returns_zero(self):
        assert compute_e1rm(float("nan"), 10) == 0.0

    def test_nan_reps_returns_zero(self):
        assert compute_e1rm(100.0, float("nan")) == 0.0

    def test_very_high_reps(self):
        # Should still compute without overflow
        result = compute_e1rm(50.0, 100)
        assert result > 0
        assert math.isfinite(result)


# ═══════════════════════════════════════════════════════════════════════════════
# 2. compute_best_e1rm_per_session
# ═══════════════════════════════════════════════════════════════════════════════

class TestComputeBestE1RMPerSession:
    def test_empty_input(self):
        assert compute_best_e1rm_per_session([]) == {}

    def test_single_session_single_set(self):
        sessions = [_make_session("Bench Press", 1, 100.0, 8)]
        result = compute_best_e1rm_per_session(sessions)
        assert "bench press" in result
        assert len(result["bench press"]) == 1
        assert result["bench press"][0].best_e1rm > 0

    def test_case_insensitive_grouping(self):
        sessions = [
            _make_session("Bench Press", 2, 100.0, 8),
            _make_session("bench press", 1, 105.0, 8),
        ]
        result = compute_best_e1rm_per_session(sessions)
        assert "bench press" in result
        assert len(result["bench press"]) == 2

    def test_best_set_selected_per_session(self):
        """When multiple sets in one session, the best e1RM is picked."""
        s = SessionExerciseData(
            session_date=date.today(),
            exercise_name="squat",
            sets=[
                SetData(reps=10, weight_kg=80.0),   # e1rm ≈ 106.67
                SetData(reps=5, weight_kg=100.0),    # e1rm ≈ 116.67
            ],
        )
        result = compute_best_e1rm_per_session([s])
        assert len(result["squat"]) == 1
        assert abs(result["squat"][0].best_e1rm - 116.667) < 0.01

    def test_blank_exercise_name_skipped(self):
        sessions = [_make_session("", 1, 100.0, 8)]
        result = compute_best_e1rm_per_session(sessions)
        assert len(result) == 0

    def test_whitespace_exercise_name_skipped(self):
        sessions = [_make_session("   ", 1, 100.0, 8)]
        result = compute_best_e1rm_per_session(sessions)
        assert len(result) == 0

    def test_sorted_by_date(self):
        sessions = [
            _make_session("squat", 1, 100.0, 8),
            _make_session("squat", 5, 90.0, 8),
            _make_session("squat", 3, 95.0, 8),
        ]
        result = compute_best_e1rm_per_session(sessions)
        dates = [p.session_date for p in result["squat"]]
        assert dates == sorted(dates)

    def test_zero_weight_sets_excluded(self):
        s = SessionExerciseData(
            session_date=date.today(),
            exercise_name="curl",
            sets=[SetData(reps=10, weight_kg=0.0)],
        )
        result = compute_best_e1rm_per_session([s])
        # No valid e1rm, so no points
        assert result.get("curl", []) == []


# ═══════════════════════════════════════════════════════════════════════════════
# 3. detect_regressions
# ═══════════════════════════════════════════════════════════════════════════════

class TestDetectRegressions:
    def test_empty_series(self):
        assert detect_regressions({}) == []

    def test_no_regression_with_single_point(self):
        series = {
            "bench press": [
                ExerciseE1RM(date.today(), "bench press", 100.0, 80.0, 8),
            ]
        }
        assert detect_regressions(series) == []

    def test_no_regression_when_improving(self):
        series = {
            "bench press": [
                ExerciseE1RM(date.today() - timedelta(days=3), "bench press", 100.0, 80.0, 8),
                ExerciseE1RM(date.today() - timedelta(days=2), "bench press", 105.0, 82.0, 8),
                ExerciseE1RM(date.today() - timedelta(days=1), "bench press", 110.0, 85.0, 8),
            ]
        }
        assert detect_regressions(series) == []

    def test_detects_two_consecutive_declines(self):
        series = {
            "bench press": [
                ExerciseE1RM(date.today() - timedelta(days=3), "bench press", 110.0, 85.0, 8),
                ExerciseE1RM(date.today() - timedelta(days=2), "bench press", 105.0, 82.0, 8),
                ExerciseE1RM(date.today() - timedelta(days=1), "bench press", 100.0, 80.0, 8),
            ]
        }
        result = detect_regressions(series, min_consecutive=2)
        assert len(result) == 1
        assert result[0].exercise_name == "bench press"
        assert result[0].consecutive_declines == 2
        assert result[0].decline_pct > 0

    def test_min_consecutive_respected(self):
        series = {
            "squat": [
                ExerciseE1RM(date.today() - timedelta(days=2), "squat", 200.0, 150.0, 8),
                ExerciseE1RM(date.today() - timedelta(days=1), "squat", 195.0, 148.0, 8),
            ]
        }
        # Only 1 decline, need 2
        assert detect_regressions(series, min_consecutive=2) == []

    def test_invalid_min_consecutive(self):
        assert detect_regressions({"a": []}, min_consecutive=0) == []
        assert detect_regressions({"a": []}, min_consecutive=-1) == []


# ═══════════════════════════════════════════════════════════════════════════════
# 4. compute_nutrition_compliance
# ═══════════════════════════════════════════════════════════════════════════════

class TestComputeNutritionCompliance:
    def test_perfect_compliance(self):
        assert compute_nutrition_compliance(2000.0, 2000.0) == 1.0

    def test_half_compliance(self):
        assert abs(compute_nutrition_compliance(1000.0, 2000.0) - 0.5) < 0.001

    def test_over_eating_clamped(self):
        assert compute_nutrition_compliance(5000.0, 2000.0) == 2.0

    def test_zero_target_returns_one(self):
        assert compute_nutrition_compliance(2000.0, 0.0) == 1.0

    def test_negative_target_returns_one(self):
        assert compute_nutrition_compliance(2000.0, -500.0) == 1.0

    def test_negative_calories_returns_zero(self):
        assert compute_nutrition_compliance(-100.0, 2000.0) == 0.0

    def test_nan_total_returns_one(self):
        assert compute_nutrition_compliance(float("nan"), 2000.0) == 1.0

    def test_nan_target_returns_one(self):
        assert compute_nutrition_compliance(2000.0, float("nan")) == 1.0

    def test_zero_calories_returns_zero(self):
        assert compute_nutrition_compliance(0.0, 2000.0) == 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# 5. compute_fatigue_score
# ═══════════════════════════════════════════════════════════════════════════════

class TestComputeFatigueScore:
    def test_zero_everything_returns_zero(self):
        result = compute_fatigue_score("chest", [], 0, 22, 0, None)
        assert result.score == 0.0
        assert result.muscle_group == "chest"

    def test_max_volume_contributes(self):
        result = compute_fatigue_score("chest", [], 30, 22, 0, None)
        assert result.volume_component > 0
        assert result.score > 0

    def test_high_frequency_contributes(self):
        result = compute_fatigue_score("chest", [], 0, 22, 5, None)
        assert result.frequency_component == 1.0

    def test_poor_nutrition_contributes(self):
        result = compute_fatigue_score("chest", [], 0, 22, 0, 0.5)
        assert result.nutrition_component > 0

    def test_good_nutrition_no_contribution(self):
        result = compute_fatigue_score("chest", [], 0, 22, 0, 0.9)
        assert result.nutrition_component == 0.0

    def test_none_nutrition_no_contribution(self):
        result = compute_fatigue_score("chest", [], 0, 22, 0, None)
        assert result.nutrition_component == 0.0

    def test_score_clamped_to_100(self):
        # Even with extreme inputs, score should not exceed 100
        regs = [
            RegressionSignal("bench press", "chest", 5, 200.0, 100.0, 50.0),
            RegressionSignal("incline press", "chest", 5, 200.0, 100.0, 50.0),
            RegressionSignal("dumbbell flyes", "chest", 5, 200.0, 100.0, 50.0),
        ]
        result = compute_fatigue_score("chest", regs, 50, 22, 7, 0.1)
        assert result.score <= 100.0

    def test_score_never_negative(self):
        result = compute_fatigue_score("chest", [], -5, 22, -3, 2.0)
        assert result.score >= 0.0

    def test_zero_mrv_no_division_error(self):
        result = compute_fatigue_score("unknown_muscle", [], 10, 0, 2, None)
        assert result.volume_component == 0.0
        assert result.score >= 0.0

    def test_regression_component_caps_at_one(self):
        regs = [
            RegressionSignal(f"ex{i}", "chest", 3, 100.0, 80.0, 20.0)
            for i in range(10)
        ]
        result = compute_fatigue_score("chest", regs, 0, 22, 0, None)
        assert result.regression_component == 1.0


# ═══════════════════════════════════════════════════════════════════════════════
# 6. generate_suggestions
# ═══════════════════════════════════════════════════════════════════════════════

class TestGenerateSuggestions:
    def test_no_suggestions_below_threshold(self):
        scores = [FatigueScoreResult("chest", 50.0, 0.5, 0.5, 0.5, 0.0)]
        result = generate_suggestions(scores, [])
        assert result == []

    def test_suggestion_above_threshold(self):
        scores = [FatigueScoreResult("chest", 80.0, 0.8, 0.8, 0.8, 0.0)]
        regs = [RegressionSignal("bench press", "chest", 3, 120.0, 100.0, 16.7)]
        result = generate_suggestions(scores, regs)
        assert len(result) == 1
        assert result[0].muscle_group == "chest"
        assert "bench press" in result[0].top_regressed_exercise

    def test_suggestion_without_regressions(self):
        scores = [FatigueScoreResult("chest", 80.0, 0.0, 0.8, 0.8, 0.5)]
        result = generate_suggestions(scores, [])
        assert len(result) == 1
        assert result[0].top_regressed_exercise == "general"

    def test_decline_sessions_minimum_two(self):
        scores = [FatigueScoreResult("chest", 80.0, 0.0, 0.8, 0.8, 0.5)]
        result = generate_suggestions(scores, [])
        assert result[0].decline_sessions >= 2

    def test_empty_scores(self):
        assert generate_suggestions([], []) == []

    def test_custom_threshold(self):
        config = FatigueConfig(fatigue_threshold=50.0)
        scores = [FatigueScoreResult("chest", 55.0, 0.5, 0.5, 0.5, 0.0)]
        result = generate_suggestions(scores, [], config)
        assert len(result) == 1


# ═══════════════════════════════════════════════════════════════════════════════
# 7. get_fatigue_color
# ═══════════════════════════════════════════════════════════════════════════════

class TestGetFatigueColor:
    def test_green_zone(self):
        assert get_fatigue_color(0) == "#4CAF50"
        assert get_fatigue_color(15) == "#4CAF50"
        assert get_fatigue_color(30) == "#4CAF50"

    def test_yellow_zone(self):
        assert get_fatigue_color(31) == "#FFC107"
        assert get_fatigue_color(45) == "#FFC107"
        assert get_fatigue_color(60) == "#FFC107"

    def test_red_zone(self):
        assert get_fatigue_color(61) == "#F44336"
        assert get_fatigue_color(80) == "#F44336"
        assert get_fatigue_color(100) == "#F44336"

    def test_negative_clamped_to_green(self):
        assert get_fatigue_color(-10) == "#4CAF50"

    def test_over_100_clamped_to_red(self):
        assert get_fatigue_color(150) == "#F44336"


# ═══════════════════════════════════════════════════════════════════════════════
# 8. Integration / end-to-end engine flow
# ═══════════════════════════════════════════════════════════════════════════════

class TestEndToEndFlow:
    def test_full_pipeline_no_data(self):
        """Empty training data should produce no scores and no suggestions."""
        e1rm = compute_best_e1rm_per_session([])
        regs = detect_regressions(e1rm)
        assert e1rm == {}
        assert regs == []

    def test_full_pipeline_single_session(self):
        """Single session should produce scores but no regressions."""
        sessions = [_make_session("bench press", 1, 100.0, 8)]
        e1rm = compute_best_e1rm_per_session(sessions)
        regs = detect_regressions(e1rm)
        assert len(regs) == 0
        # Can still compute a fatigue score
        score = compute_fatigue_score("chest", regs, 3, 22, 1, None)
        assert score.score >= 0

    def test_full_pipeline_declining_performance(self):
        """Declining performance across sessions should trigger regression and suggestion."""
        sessions = _make_declining_sessions("bench press", 5, start_weight=100.0, drop=5.0)
        e1rm = compute_best_e1rm_per_session(sessions)
        regs = detect_regressions(e1rm, min_consecutive=2)
        assert len(regs) >= 1
        assert regs[0].muscle_group == "chest"

        score = compute_fatigue_score(
            "chest", regs, weekly_sets=20, mrv_sets=22,
            weekly_frequency=4, nutrition_compliance=0.6,
        )
        assert score.score > 0

        suggestions = generate_suggestions([score], regs)
        # Whether we get a suggestion depends on the threshold
        # With high volume + regression + poor nutrition, score should be high
        if score.score > 70:
            assert len(suggestions) >= 1

    def test_very_high_volume_triggers_fatigue(self):
        """Volume at or above MRV should contribute to fatigue score."""
        score = compute_fatigue_score(
            "chest", [], weekly_sets=25, mrv_sets=22,
            weekly_frequency=5, nutrition_compliance=None,
        )
        # Volume component should be capped at 1.0
        assert score.volume_component == 1.0
        assert score.frequency_component == 1.0
        assert score.score > 0


# ═══════════════════════════════════════════════════════════════════════════════
# 9. MRV_SETS_PER_WEEK sanity
# ═══════════════════════════════════════════════════════════════════════════════

class TestMRVConstants:
    def test_all_values_positive(self):
        for mg, v in MRV_SETS_PER_WEEK.items():
            assert v > 0, f"MRV for {mg} should be positive"

    def test_expected_muscle_groups_present(self):
        expected = {"chest", "back", "shoulders", "quads", "hamstrings", "biceps", "triceps"}
        assert expected.issubset(set(MRV_SETS_PER_WEEK.keys()))
