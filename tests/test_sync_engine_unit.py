"""Unit tests for the Nutrition-Training Sync Engine (pure computation)."""

import pytest

from src.modules.adaptive.sync_engine import (
    COMPOUND_BONUS_CAP,
    MIN_CARBS_G,
    MIN_FAT_G,
    SessionExercise,
    DailyTargetInput,
    compute_daily_targets,
    compute_muscle_group_demand,
    compute_session_volume,
    compute_volume_multiplier,
)
from src.shared.types import TrainingPhase


def _ex(name="curl", group="biceps", compound=False, sets=3, reps=10, volume=300.0):
    return SessionExercise(
        exercise_name=name, muscle_group=group, is_compound=compound,
        total_sets=sets, total_reps=reps, total_volume=volume,
    )


def _base_input(**overrides):
    defaults = dict(
        baseline_calories=2500, baseline_protein_g=180, baseline_carbs_g=250,
        baseline_fat_g=80, is_training_day=True, session_exercises=[],
        session_volume=5000, rolling_avg_volume=5000,
        training_phase=TrainingPhase.NONE,
    )
    defaults.update(overrides)
    return DailyTargetInput(**defaults)


# ── compute_muscle_group_demand ──────────────────────────────────────────

class TestMuscleDemand:
    def test_empty_exercises(self):
        assert compute_muscle_group_demand([]) == 0.0

    def test_single_isolation(self):
        result = compute_muscle_group_demand([_ex(group="biceps")])
        assert 0 < result < 0.1

    def test_full_leg_day(self):
        exercises = [
            _ex(group="quads", compound=True),
            _ex(group="hamstrings", compound=True),
            _ex(group="glutes"),
            _ex(group="calves"),
        ]
        result = compute_muscle_group_demand(exercises)
        assert result > 0.5

    def test_compound_bonus_capped(self):
        exercises = [_ex(group=f"g{i}", compound=True) for i in range(10)]
        result = compute_muscle_group_demand(exercises)
        assert result <= 1.0

    def test_duplicate_groups_not_double_counted(self):
        exercises = [_ex(group="chest"), _ex(group="chest"), _ex(group="chest")]
        single = compute_muscle_group_demand([_ex(group="chest")])
        triple = compute_muscle_group_demand(exercises)
        assert triple == single  # same group, no extra weight

    def test_unknown_group_no_crash(self):
        result = compute_muscle_group_demand([_ex(group="unknown_muscle")])
        assert result >= 0.0

    def test_result_always_lte_one(self):
        all_groups = [_ex(group=g, compound=True) for g in
                      ["quads", "hamstrings", "glutes", "calves", "back", "chest",
                       "shoulders", "biceps", "triceps", "forearms", "abs", "traps"]]
        assert compute_muscle_group_demand(all_groups) <= 1.0


# ── compute_volume_multiplier ────────────────────────────────────────────

class TestVolumeMultiplier:
    def test_zero_rolling_avg(self):
        assert compute_volume_multiplier(5000, 0) == 1.0

    def test_zero_session(self):
        assert compute_volume_multiplier(0, 5000) == 1.0

    def test_equal_volumes(self):
        assert compute_volume_multiplier(5000, 5000) == 1.0

    def test_double_volume_clamped(self):
        assert compute_volume_multiplier(10000, 5000) == 1.5

    def test_half_volume_clamped(self):
        assert compute_volume_multiplier(2500, 5000) == 0.7

    def test_normal_ratio(self):
        result = compute_volume_multiplier(6000, 5000)
        assert 1.0 < result < 1.5


# ── compute_session_volume ───────────────────────────────────────────────

class TestSessionVolume:
    def test_empty(self):
        assert compute_session_volume([]) == 0.0

    def test_sums_correctly(self):
        exercises = [_ex(volume=100), _ex(volume=200), _ex(volume=300)]
        assert compute_session_volume(exercises) == 600.0


# ── compute_daily_targets ────────────────────────────────────────────────

class TestDailyTargets:
    def test_rest_day_negative_delta(self):
        out = compute_daily_targets(_base_input(is_training_day=False))
        assert out.calorie_delta < 0
        assert out.day_classification == "rest_day"

    def test_training_day_positive_delta(self):
        out = compute_daily_targets(_base_input(is_training_day=True))
        assert out.calorie_delta > 0
        assert out.day_classification == "training_day"

    def test_deload_zeroes_surplus(self):
        out = compute_daily_targets(_base_input(
            training_phase=TrainingPhase.DELOAD, is_training_day=True,
        ))
        assert out.calorie_delta == 0
        assert out.phase_modifier == 0.0

    def test_accumulation_bonus(self):
        normal = compute_daily_targets(_base_input(training_phase=TrainingPhase.NONE))
        accum = compute_daily_targets(_base_input(training_phase=TrainingPhase.ACCUMULATION))
        assert accum.calorie_delta > normal.calorie_delta

    def test_protein_never_reduced(self):
        out = compute_daily_targets(_base_input(is_training_day=False))
        assert out.adjusted_protein_g == 180

    def test_carbs_floor(self):
        out = compute_daily_targets(_base_input(
            baseline_carbs_g=10, is_training_day=False,
        ))
        assert out.adjusted_carbs_g >= MIN_CARBS_G

    def test_fat_floor(self):
        out = compute_daily_targets(_base_input(
            baseline_fat_g=5, is_training_day=False,
        ))
        assert out.adjusted_fat_g >= MIN_FAT_G

    def test_explanation_rest_day(self):
        out = compute_daily_targets(_base_input(is_training_day=False))
        assert "Rest day" in out.explanation

    def test_explanation_leg_day(self):
        exercises = [_ex(group="quads", compound=True)]
        out = compute_daily_targets(_base_input(session_exercises=exercises))
        assert "Leg day" in out.explanation

    def test_zero_baseline_no_crash(self):
        out = compute_daily_targets(_base_input(
            baseline_calories=0, baseline_protein_g=0,
            baseline_carbs_g=0, baseline_fat_g=0,
        ))
        assert out.adjusted_calories >= 0
        assert out.adjusted_carbs_g >= MIN_CARBS_G
        assert out.adjusted_fat_g >= MIN_FAT_G
