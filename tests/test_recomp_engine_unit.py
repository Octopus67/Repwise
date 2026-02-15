"""Unit tests for the recomp engine pure functions."""

from __future__ import annotations

from datetime import date, timedelta
from typing import List, Optional

import math
import pytest

from src.modules.recomp.engine import (
    MIN_CALORIES,
    MIN_CARBS_G,
    MIN_FAT_G,
    CARB_SHIFT_RATIO,
    MeasurementPoint,
    RecompCheckinInput,
    RecompDailyInput,
    RecompMetricsInput,
    RecompMetricsOutput,
    TrendResult,
    compute_recomp_checkin,
    compute_recomp_daily_targets,
    compute_recomp_score,
    compute_trend,
    _filter_lookback,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_points(values: list[float], start: Optional[date] = None) -> list[MeasurementPoint]:
    """Build measurement points from a list of values, one per day."""
    start = start or date(2024, 1, 1)
    return [MeasurementPoint(date=start + timedelta(days=i), value=v) for i, v in enumerate(values)]


def _default_daily_input(**overrides) -> RecompDailyInput:
    defaults = dict(
        tdee=2500.0,
        is_training_day=True,
        weight_kg=80.0,
        baseline_protein_g=160.0,
        baseline_carbs_g=250.0,
        baseline_fat_g=70.0,
        surplus_pct=0.10,
        deficit_pct=-0.10,
    )
    defaults.update(overrides)
    return RecompDailyInput(**defaults)


def _make_metrics_output(
    waist_dir: str = "decreasing",
    arm_dir: str = "increasing",
    chest_dir: str = "stable",
    score: Optional[float] = 50.0,
    sufficient: bool = True,
) -> RecompMetricsOutput:
    return RecompMetricsOutput(
        waist_trend=TrendResult(slope_per_week=-0.3, direction=waist_dir, data_points=5),
        arm_trend=TrendResult(slope_per_week=0.2, direction=arm_dir, data_points=5),
        chest_trend=TrendResult(slope_per_week=0.0, direction=chest_dir, data_points=5),
        weight_trend=TrendResult(slope_per_week=-0.1, direction="decreasing", data_points=5),
        muscle_gain_indicator=0.1,
        fat_loss_indicator=0.3,
        recomp_score=score,
        has_sufficient_data=sufficient,
    )


# ===========================================================================
# compute_trend
# ===========================================================================

class TestComputeTrend:
    def test_returns_none_for_empty_list(self):
        assert compute_trend([]) is None

    def test_returns_none_for_single_point(self):
        pts = _make_points([80.0])
        assert compute_trend(pts) is None

    def test_two_points_increasing(self):
        pts = _make_points([80.0, 81.0])
        result = compute_trend(pts)
        assert result is not None
        assert result.direction == "increasing"
        assert result.slope_per_week == pytest.approx(7.0)
        assert result.data_points == 2

    def test_two_points_decreasing(self):
        pts = _make_points([81.0, 80.0])
        result = compute_trend(pts)
        assert result is not None
        assert result.direction == "decreasing"
        assert result.slope_per_week == pytest.approx(-7.0)

    def test_constant_values_stable(self):
        pts = _make_points([80.0, 80.0, 80.0, 80.0])
        result = compute_trend(pts)
        assert result is not None
        assert result.direction == "stable"
        assert result.slope_per_week == pytest.approx(0.0)

    def test_same_date_returns_stable(self):
        """All points on the same date → denominator=0 → stable."""
        d = date(2024, 1, 1)
        pts = [MeasurementPoint(date=d, value=v) for v in [80.0, 81.0, 82.0]]
        result = compute_trend(pts)
        assert result is not None
        assert result.direction == "stable"
        assert result.slope_per_week == 0.0

    def test_nan_values_filtered(self):
        """NaN values should be filtered out."""
        pts = _make_points([80.0, float('nan'), 81.0, float('nan'), 82.0])
        result = compute_trend(pts)
        assert result is not None
        assert result.data_points == 3  # only finite values counted

    def test_all_nan_returns_none(self):
        pts = [MeasurementPoint(date=date(2024, 1, i + 1), value=float('nan')) for i in range(5)]
        assert compute_trend(pts) is None

    def test_inf_values_filtered(self):
        pts = _make_points([80.0, float('inf'), 81.0])
        result = compute_trend(pts)
        assert result is not None
        assert result.data_points == 2

    def test_slope_near_zero_is_stable(self):
        """Slope within ±0.05 should be 'stable'."""
        pts = _make_points([80.0, 80.001, 80.002, 80.003, 80.004, 80.005, 80.006])
        result = compute_trend(pts)
        assert result is not None
        assert result.direction == "stable"

    def test_determinism(self):
        pts = _make_points([80.0, 81.0, 79.5, 80.5, 82.0])
        r1 = compute_trend(pts)
        r2 = compute_trend(pts)
        assert r1 == r2


# ===========================================================================
# _filter_lookback
# ===========================================================================

class TestFilterLookback:
    def test_empty_list(self):
        assert _filter_lookback([], 28) == []

    def test_all_within_window(self):
        pts = _make_points([80.0, 81.0, 82.0])
        result = _filter_lookback(pts, 28)
        assert len(result) == 3

    def test_filters_old_points(self):
        old = MeasurementPoint(date=date(2024, 1, 1), value=80.0)
        recent = MeasurementPoint(date=date(2024, 2, 1), value=81.0)
        very_recent = MeasurementPoint(date=date(2024, 2, 5), value=82.0)
        result = _filter_lookback([old, recent, very_recent], 7)
        assert len(result) == 2
        assert old not in result


# ===========================================================================
# compute_recomp_score
# ===========================================================================

class TestComputeRecompScore:
    def test_empty_inputs_insufficient_data(self):
        inp = RecompMetricsInput(
            waist_measurements=[],
            arm_measurements=[],
            chest_measurements=[],
            bodyweight_history=[],
        )
        out = compute_recomp_score(inp)
        assert out.has_sufficient_data is False
        assert out.recomp_score is None

    def test_waist_only_no_muscle_indicator(self):
        inp = RecompMetricsInput(
            waist_measurements=_make_points([90.0, 89.5, 89.0, 88.5]),
            arm_measurements=[],
            chest_measurements=[],
            bodyweight_history=[],
        )
        out = compute_recomp_score(inp)
        assert out.fat_loss_indicator is not None
        assert out.muscle_gain_indicator is None
        assert out.has_sufficient_data is False

    def test_full_data_has_score(self):
        inp = RecompMetricsInput(
            waist_measurements=_make_points([90.0, 89.5, 89.0, 88.5]),
            arm_measurements=_make_points([35.0, 35.2, 35.4, 35.6]),
            chest_measurements=_make_points([100.0, 100.5, 101.0, 101.5]),
            bodyweight_history=_make_points([80.0, 80.1, 80.0, 79.9]),
        )
        out = compute_recomp_score(inp)
        assert out.has_sufficient_data is True
        assert out.recomp_score is not None
        assert -100.0 <= out.recomp_score <= 100.0

    def test_positive_recomp_waist_down_arms_up(self):
        """Waist decreasing + arms increasing → positive score."""
        inp = RecompMetricsInput(
            waist_measurements=_make_points([90.0, 89.0, 88.0, 87.0]),
            arm_measurements=_make_points([35.0, 35.5, 36.0, 36.5]),
            chest_measurements=[],
            bodyweight_history=[],
        )
        out = compute_recomp_score(inp)
        assert out.has_sufficient_data is True
        assert out.recomp_score is not None
        assert out.recomp_score > 0

    def test_negative_recomp_waist_up_arms_down(self):
        """Waist increasing + arms decreasing → negative score."""
        inp = RecompMetricsInput(
            waist_measurements=_make_points([87.0, 88.0, 89.0, 90.0]),
            arm_measurements=_make_points([36.5, 36.0, 35.5, 35.0]),
            chest_measurements=[],
            bodyweight_history=[],
        )
        out = compute_recomp_score(inp)
        assert out.has_sufficient_data is True
        assert out.recomp_score is not None
        assert out.recomp_score < 0

    def test_score_clamped_to_range(self):
        """Score should always be in [-100, 100]."""
        # Extreme values
        inp = RecompMetricsInput(
            waist_measurements=_make_points([100.0, 50.0]),  # massive drop
            arm_measurements=_make_points([30.0, 60.0]),  # massive gain
            chest_measurements=[],
            bodyweight_history=[],
        )
        out = compute_recomp_score(inp)
        assert out.recomp_score is not None
        assert -100.0 <= out.recomp_score <= 100.0

    def test_determinism(self):
        inp = RecompMetricsInput(
            waist_measurements=_make_points([90.0, 89.5, 89.0]),
            arm_measurements=_make_points([35.0, 35.2, 35.4]),
            chest_measurements=_make_points([100.0, 100.5, 101.0]),
            bodyweight_history=_make_points([80.0, 80.1, 80.0]),
        )
        out1 = compute_recomp_score(inp)
        out2 = compute_recomp_score(inp)
        assert out1 == out2

    def test_lookback_filters_old_data(self):
        """Points outside lookback window should be excluded."""
        old_start = date(2024, 1, 1)
        recent_start = date(2024, 3, 1)
        old_pts = [MeasurementPoint(date=old_start + timedelta(days=i), value=100.0 - i) for i in range(5)]
        recent_pts = [MeasurementPoint(date=recent_start + timedelta(days=i), value=90.0 + i * 0.1) for i in range(5)]
        all_pts = old_pts + recent_pts

        inp = RecompMetricsInput(
            waist_measurements=all_pts,
            arm_measurements=recent_pts,
            chest_measurements=[],
            bodyweight_history=[],
            lookback_days=14,
        )
        out = compute_recomp_score(inp)
        # Waist trend should be based on recent data (slightly increasing), not old data
        assert out.waist_trend is not None
        assert out.waist_trend.data_points == 5  # only recent points


# ===========================================================================
# compute_recomp_daily_targets
# ===========================================================================

class TestComputeRecompDailyTargets:
    def test_training_day_surplus(self):
        inp = _default_daily_input(is_training_day=True)
        out = compute_recomp_daily_targets(inp)
        assert out.adjusted_calories > inp.tdee
        assert out.calorie_delta > 0
        assert out.is_training_day is True

    def test_rest_day_deficit(self):
        inp = _default_daily_input(is_training_day=False)
        out = compute_recomp_daily_targets(inp)
        assert out.adjusted_calories < inp.tdee
        assert out.calorie_delta < 0
        assert out.is_training_day is False

    def test_minimum_calories_enforced(self):
        inp = _default_daily_input(tdee=1300.0, deficit_pct=-0.50, is_training_day=False)
        out = compute_recomp_daily_targets(inp)
        assert out.adjusted_calories >= MIN_CALORIES

    def test_protein_floor_2g_per_kg(self):
        inp = _default_daily_input(baseline_protein_g=100.0, weight_kg=80.0)
        out = compute_recomp_daily_targets(inp)
        assert out.adjusted_protein_g >= 2.0 * 80.0

    def test_protein_keeps_higher_baseline(self):
        inp = _default_daily_input(baseline_protein_g=200.0, weight_kg=80.0)
        out = compute_recomp_daily_targets(inp)
        assert out.adjusted_protein_g >= 200.0

    def test_carbs_minimum_enforced(self):
        inp = _default_daily_input(baseline_carbs_g=30.0, is_training_day=False, deficit_pct=-0.30)
        out = compute_recomp_daily_targets(inp)
        assert out.adjusted_carbs_g >= MIN_CARBS_G

    def test_fat_minimum_enforced(self):
        inp = _default_daily_input(baseline_fat_g=10.0, is_training_day=False, deficit_pct=-0.30)
        out = compute_recomp_daily_targets(inp)
        assert out.adjusted_fat_g >= MIN_FAT_G

    def test_zero_surplus_no_change(self):
        inp = _default_daily_input(surplus_pct=0.0, is_training_day=True)
        out = compute_recomp_daily_targets(inp)
        assert out.calorie_delta == pytest.approx(0.0)

    def test_zero_deficit_no_change(self):
        inp = _default_daily_input(deficit_pct=0.0, is_training_day=False)
        out = compute_recomp_daily_targets(inp)
        assert out.calorie_delta == pytest.approx(0.0)

    def test_invalid_tdee_raises(self):
        with pytest.raises(ValueError, match="TDEE must be positive"):
            compute_recomp_daily_targets(_default_daily_input(tdee=0.0))

    def test_negative_tdee_raises(self):
        with pytest.raises(ValueError, match="TDEE must be positive"):
            compute_recomp_daily_targets(_default_daily_input(tdee=-100.0))

    def test_invalid_weight_raises(self):
        with pytest.raises(ValueError, match="Weight must be positive"):
            compute_recomp_daily_targets(_default_daily_input(weight_kg=0.0))

    def test_determinism(self):
        inp = _default_daily_input()
        out1 = compute_recomp_daily_targets(inp)
        out2 = compute_recomp_daily_targets(inp)
        assert out1 == out2

    def test_training_day_carb_shift(self):
        """Training day surplus should shift more calories to carbs."""
        inp = _default_daily_input(is_training_day=True, surplus_pct=0.20)
        out = compute_recomp_daily_targets(inp)
        # Carbs should be higher than baseline
        assert out.adjusted_carbs_g > inp.baseline_carbs_g

    def test_rest_day_carb_reduction(self):
        """Rest day deficit should reduce carbs more than fat."""
        inp = _default_daily_input(is_training_day=False, deficit_pct=-0.20)
        out = compute_recomp_daily_targets(inp)
        assert out.adjusted_carbs_g < inp.baseline_carbs_g


# ===========================================================================
# compute_recomp_checkin
# ===========================================================================

class TestComputeRecompCheckin:
    def test_insufficient_data_recommendation(self):
        metrics = _make_metrics_output(sufficient=False, score=None)
        inp = RecompCheckinInput(
            recomp_metrics=metrics,
            weekly_weight_change_kg=None,
            current_training_day_surplus_pct=0.10,
            current_rest_day_deficit_pct=-0.10,
        )
        out = compute_recomp_checkin(inp)
        assert "Log body measurements" in out.recommendation
        assert out.suggested_surplus_adjustment is None
        assert out.suggested_deficit_adjustment is None

    def test_weight_dropping_too_fast(self):
        metrics = _make_metrics_output()
        inp = RecompCheckinInput(
            recomp_metrics=metrics,
            weekly_weight_change_kg=-0.8,
            current_training_day_surplus_pct=0.10,
            current_rest_day_deficit_pct=-0.10,
        )
        out = compute_recomp_checkin(inp)
        assert "dropping too fast" in out.recommendation.lower()
        assert out.suggested_surplus_adjustment == 0.02

    def test_weight_gaining_too_fast(self):
        metrics = _make_metrics_output()
        inp = RecompCheckinInput(
            recomp_metrics=metrics,
            weekly_weight_change_kg=0.8,
            current_training_day_surplus_pct=0.10,
            current_rest_day_deficit_pct=-0.10,
        )
        out = compute_recomp_checkin(inp)
        assert "gaining too fast" in out.recommendation.lower()
        assert out.suggested_deficit_adjustment == -0.02

    def test_recomp_working(self):
        metrics = _make_metrics_output(waist_dir="decreasing", arm_dir="increasing")
        inp = RecompCheckinInput(
            recomp_metrics=metrics,
            weekly_weight_change_kg=-0.2,
            current_training_day_surplus_pct=0.10,
            current_rest_day_deficit_pct=-0.10,
        )
        out = compute_recomp_checkin(inp)
        assert "recomp is working" in out.recommendation.lower()

    def test_waist_increasing_recommendation(self):
        metrics = _make_metrics_output(waist_dir="increasing", arm_dir="stable", chest_dir="stable")
        inp = RecompCheckinInput(
            recomp_metrics=metrics,
            weekly_weight_change_kg=0.1,
            current_training_day_surplus_pct=0.10,
            current_rest_day_deficit_pct=-0.10,
        )
        out = compute_recomp_checkin(inp)
        assert "waist increasing" in out.recommendation.lower()
        assert out.suggested_deficit_adjustment == -0.02

    def test_default_stay_consistent(self):
        metrics = _make_metrics_output(waist_dir="stable", arm_dir="stable", chest_dir="stable")
        inp = RecompCheckinInput(
            recomp_metrics=metrics,
            weekly_weight_change_kg=0.0,
            current_training_day_surplus_pct=0.10,
            current_rest_day_deficit_pct=-0.10,
        )
        out = compute_recomp_checkin(inp)
        assert "stay consistent" in out.recommendation.lower()

    def test_none_weight_change_skips_weight_branches(self):
        metrics = _make_metrics_output(waist_dir="stable", arm_dir="stable")
        inp = RecompCheckinInput(
            recomp_metrics=metrics,
            weekly_weight_change_kg=None,
            current_training_day_surplus_pct=0.10,
            current_rest_day_deficit_pct=-0.10,
        )
        out = compute_recomp_checkin(inp)
        # Should not hit weight-related branches
        assert "dropping" not in out.recommendation.lower()
        assert "gaining" not in out.recommendation.lower()


# ===========================================================================
# Edge cases
# ===========================================================================

class TestEdgeCases:
    def test_zero_body_fat_indicator(self):
        """Zero fat loss indicator should produce a valid score."""
        inp = RecompMetricsInput(
            waist_measurements=_make_points([80.0, 80.0, 80.0]),
            arm_measurements=_make_points([35.0, 35.0, 35.0]),
            chest_measurements=[],
            bodyweight_history=[],
        )
        out = compute_recomp_score(inp)
        assert out.has_sufficient_data is True
        assert out.recomp_score is not None
        assert math.isfinite(out.recomp_score)

    def test_extreme_measurement_values(self):
        """Very large measurement values should not cause overflow."""
        inp = RecompMetricsInput(
            waist_measurements=_make_points([150.0, 149.0, 148.0]),
            arm_measurements=_make_points([50.0, 51.0, 52.0]),
            chest_measurements=_make_points([130.0, 131.0, 132.0]),
            bodyweight_history=_make_points([150.0, 149.5, 149.0]),
        )
        out = compute_recomp_score(inp)
        assert out.has_sufficient_data is True
        assert out.recomp_score is not None
        assert math.isfinite(out.recomp_score)

    def test_very_small_changes(self):
        """Tiny measurement changes should produce stable trends."""
        inp = RecompMetricsInput(
            waist_measurements=_make_points([80.0, 80.001, 80.002]),
            arm_measurements=_make_points([35.0, 35.001, 35.002]),
            chest_measurements=[],
            bodyweight_history=[],
        )
        out = compute_recomp_score(inp)
        assert out.waist_trend is not None
        assert out.waist_trend.direction == "stable"

    def test_single_day_all_measurements(self):
        """All measurements on the same day → trends should be None or stable."""
        d = date(2024, 6, 1)
        pts = [MeasurementPoint(date=d, value=80.0)]
        inp = RecompMetricsInput(
            waist_measurements=pts,
            arm_measurements=pts,
            chest_measurements=pts,
            bodyweight_history=pts,
        )
        out = compute_recomp_score(inp)
        # Single point → None trends
        assert out.waist_trend is None
        assert out.has_sufficient_data is False

    def test_daily_targets_extreme_surplus(self):
        """Very high surplus should still produce finite values."""
        inp = _default_daily_input(surplus_pct=1.0, is_training_day=True)
        out = compute_recomp_daily_targets(inp)
        assert math.isfinite(out.adjusted_calories)
        assert math.isfinite(out.adjusted_carbs_g)
        assert math.isfinite(out.adjusted_fat_g)

    def test_daily_targets_extreme_deficit(self):
        """Very deep deficit should floor at MIN_CALORIES."""
        inp = _default_daily_input(deficit_pct=-0.90, is_training_day=False)
        out = compute_recomp_daily_targets(inp)
        assert out.adjusted_calories >= MIN_CALORIES
