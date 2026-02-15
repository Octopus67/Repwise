"""Unit tests for the readiness engine — pure computation layer.

Tests cover:
- Score computation with all factors present
- Component weight redistribution
- Edge cases: no data, all perfect, all terrible
- Score clamping to [0, 100]
- NaN / Inf guards in normalization functions
- Baseline computation with dirty data
- Individual normalization functions
"""

from __future__ import annotations

import math
from typing import Optional

import pytest

from src.modules.readiness.readiness_engine import (
    Baselines,
    FactorScore,
    HealthMetrics,
    MIN_BASELINE_DAYS,
    ReadinessResult,
    ReadinessWeights,
    UserCheckin,
    _clamp,
    _is_finite,
    compute_baselines,
    compute_readiness,
    normalize_checkin_factor,
    normalize_hrv_factor,
    normalize_resting_hr_factor,
    normalize_sleep_duration,
    normalize_sleep_quality,
    redistribute_weights,
)


# ---------------------------------------------------------------------------
# Helper: build baselines with enough data days
# ---------------------------------------------------------------------------
def _baselines(hrv_mean: float = 60.0, rhr_mean: float = 60.0, days: int = 14) -> Baselines:
    return Baselines(hrv_mean=hrv_mean, resting_hr_mean=rhr_mean, hrv_data_days=days, resting_hr_data_days=days)


# ===========================================================================
# _is_finite / _clamp helpers
# ===========================================================================
class TestHelpers:
    def test_is_finite_normal(self) -> None:
        assert _is_finite(42.0) is True
        assert _is_finite(0.0) is True
        assert _is_finite(-1.5) is True

    def test_is_finite_none(self) -> None:
        assert _is_finite(None) is False

    def test_is_finite_nan(self) -> None:
        assert _is_finite(float("nan")) is False

    def test_is_finite_inf(self) -> None:
        assert _is_finite(float("inf")) is False
        assert _is_finite(float("-inf")) is False

    def test_clamp_normal(self) -> None:
        assert _clamp(0.5) == 0.5
        assert _clamp(-0.1) == 0.0
        assert _clamp(1.5) == 1.0

    def test_clamp_nan_returns_lo(self) -> None:
        assert _clamp(float("nan")) == 0.0

    def test_clamp_custom_bounds(self) -> None:
        assert _clamp(150, 0, 100) == 100
        assert _clamp(-5, 0, 100) == 0


# ===========================================================================
# Baseline computation
# ===========================================================================
class TestComputeBaselines:
    def test_empty_history(self) -> None:
        b = compute_baselines([], [])
        assert b.hrv_mean is None
        assert b.resting_hr_mean is None
        assert b.hrv_data_days == 0
        assert b.resting_hr_data_days == 0

    def test_normal_history(self) -> None:
        b = compute_baselines([50.0, 60.0, 70.0], [55.0, 65.0])
        assert b.hrv_mean == pytest.approx(60.0)
        assert b.resting_hr_mean == pytest.approx(60.0)
        assert b.hrv_data_days == 3
        assert b.resting_hr_data_days == 2

    def test_filters_nan_and_negative(self) -> None:
        b = compute_baselines([float("nan"), -10.0, 50.0, 70.0], [float("inf"), 0.0, 60.0])
        assert b.hrv_mean == pytest.approx(60.0)
        assert b.resting_hr_mean == pytest.approx(60.0)
        assert b.hrv_data_days == 2
        assert b.resting_hr_data_days == 1

    def test_caps_at_30_days(self) -> None:
        vals = list(range(1, 50))
        b = compute_baselines([float(v) for v in vals], [])
        assert b.hrv_data_days == 30  # last 30 of 49

    def test_all_nan_returns_none(self) -> None:
        b = compute_baselines([float("nan"), float("nan")], [float("inf")])
        assert b.hrv_mean is None
        assert b.resting_hr_mean is None


# ===========================================================================
# Individual normalization functions
# ===========================================================================
class TestNormalizeHRV:
    def test_at_baseline(self) -> None:
        # ratio=1.0 → (1.0-0.7)/0.6 = 0.5
        assert normalize_hrv_factor(60.0, 60.0) == pytest.approx(0.5)

    def test_above_baseline(self) -> None:
        # ratio=1.3 → (1.3-0.7)/0.6 = 1.0
        assert normalize_hrv_factor(78.0, 60.0) == pytest.approx(1.0)

    def test_below_baseline(self) -> None:
        # ratio=0.7 → (0.7-0.7)/0.6 = 0.0
        assert normalize_hrv_factor(42.0, 60.0) == pytest.approx(0.0)

    def test_zero_baseline(self) -> None:
        assert normalize_hrv_factor(50.0, 0.0) == 0.5

    def test_nan_inputs(self) -> None:
        assert normalize_hrv_factor(float("nan"), 60.0) == 0.5
        assert normalize_hrv_factor(60.0, float("nan")) == 0.5


class TestNormalizeRestingHR:
    def test_at_baseline(self) -> None:
        # ratio=1.0 → (1.0-0.85)/0.3 = 0.5
        assert normalize_resting_hr_factor(60.0, 60.0) == pytest.approx(0.5)

    def test_lower_is_better(self) -> None:
        # current=50, baseline=60 → ratio=1.2 → (1.2-0.85)/0.3 ≈ 1.0 (clamped)
        result = normalize_resting_hr_factor(50.0, 60.0)
        assert result == pytest.approx(1.0, abs=0.17)

    def test_higher_is_worse(self) -> None:
        # current=80, baseline=60 → ratio=0.75 → (0.75-0.85)/0.3 < 0 → 0.0
        assert normalize_resting_hr_factor(80.0, 60.0) == 0.0

    def test_zero_current(self) -> None:
        assert normalize_resting_hr_factor(0.0, 60.0) == 0.5

    def test_nan_inputs(self) -> None:
        assert normalize_resting_hr_factor(float("nan"), 60.0) == 0.5


class TestNormalizeSleepDuration:
    def test_eight_hours(self) -> None:
        assert normalize_sleep_duration(8.0) == pytest.approx(1.0)

    def test_four_hours(self) -> None:
        assert normalize_sleep_duration(4.0) == pytest.approx(0.0)

    def test_six_hours(self) -> None:
        assert normalize_sleep_duration(6.0) == pytest.approx(0.5)

    def test_over_eight_clamped(self) -> None:
        assert normalize_sleep_duration(12.0) == 1.0

    def test_under_four_clamped(self) -> None:
        assert normalize_sleep_duration(2.0) == 0.0

    def test_nan_returns_zero(self) -> None:
        assert normalize_sleep_duration(float("nan")) == 0.0


class TestNormalizeCheckinFactor:
    def test_best(self) -> None:
        assert normalize_checkin_factor(1) == pytest.approx(1.0)

    def test_worst(self) -> None:
        assert normalize_checkin_factor(5) == pytest.approx(0.0)

    def test_mid(self) -> None:
        assert normalize_checkin_factor(3) == pytest.approx(0.5)


class TestNormalizeSleepQuality:
    def test_best(self) -> None:
        assert normalize_sleep_quality(5) == pytest.approx(1.0)

    def test_worst(self) -> None:
        assert normalize_sleep_quality(1) == pytest.approx(0.0)

    def test_mid(self) -> None:
        assert normalize_sleep_quality(3) == pytest.approx(0.5)


# ===========================================================================
# Weight redistribution
# ===========================================================================
class TestRedistributeWeights:
    def test_all_present(self) -> None:
        w = ReadinessWeights()
        present = {k: True for k in ["hrv_trend", "resting_hr_trend", "sleep_duration", "sleep_quality", "soreness", "stress"]}
        ew = redistribute_weights(w, present)
        assert sum(ew.values()) == pytest.approx(1.0)

    def test_none_present(self) -> None:
        w = ReadinessWeights()
        present = {k: False for k in ["hrv_trend", "resting_hr_trend", "sleep_duration", "sleep_quality", "soreness", "stress"]}
        ew = redistribute_weights(w, present)
        assert all(v == 0.0 for v in ew.values())

    def test_partial_present(self) -> None:
        w = ReadinessWeights()
        present = {"hrv_trend": True, "resting_hr_trend": False, "sleep_duration": True,
                    "sleep_quality": False, "soreness": False, "stress": False}
        ew = redistribute_weights(w, present)
        assert ew["resting_hr_trend"] == 0.0
        assert ew["hrv_trend"] > 0
        assert ew["sleep_duration"] > 0
        assert sum(ew.values()) == pytest.approx(1.0)


# ===========================================================================
# Full readiness computation
# ===========================================================================
class TestComputeReadiness:
    """Integration-level tests for the compute_readiness function."""

    def test_all_factors_absent_returns_none(self) -> None:
        """No health data, no checkin → score is None."""
        result = compute_readiness(HealthMetrics(), None, Baselines())
        assert result.score is None
        assert result.factors_present == 0
        assert result.factors_total == 6
        assert len(result.factors) == 6
        assert all(not f.present for f in result.factors)

    def test_all_perfect_score_is_100(self) -> None:
        """All factors at optimal values → score = 100."""
        health = HealthMetrics(hrv_ms=78.0, resting_hr_bpm=50.0, sleep_duration_hours=9.0)
        checkin = UserCheckin(soreness=1, stress=1, sleep_quality=5)
        baselines = _baselines(hrv_mean=60.0, rhr_mean=60.0)
        result = compute_readiness(health, checkin, baselines)
        assert result.score == 100
        assert result.factors_present == 6

    def test_all_terrible_score_is_0(self) -> None:
        """All factors at worst values → score = 0."""
        health = HealthMetrics(hrv_ms=30.0, resting_hr_bpm=90.0, sleep_duration_hours=3.0)
        checkin = UserCheckin(soreness=5, stress=5, sleep_quality=1)
        baselines = _baselines(hrv_mean=60.0, rhr_mean=60.0)
        result = compute_readiness(health, checkin, baselines)
        assert result.score == 0
        assert result.factors_present == 6

    def test_score_clamped_to_0_100(self) -> None:
        """Score must always be in [0, 100] regardless of inputs."""
        # Even with extreme values, clamping should hold
        health = HealthMetrics(hrv_ms=1000.0, resting_hr_bpm=20.0, sleep_duration_hours=24.0)
        checkin = UserCheckin(soreness=1, stress=1, sleep_quality=5)
        baselines = _baselines(hrv_mean=60.0, rhr_mean=60.0)
        result = compute_readiness(health, checkin, baselines)
        assert 0 <= result.score <= 100

    def test_only_sleep_duration_present(self) -> None:
        """Only sleep duration provided → weight redistributed to 100%."""
        health = HealthMetrics(sleep_duration_hours=8.0)
        result = compute_readiness(health, None, Baselines())
        assert result.score is not None
        assert result.factors_present == 1
        # 8h sleep → normalized=1.0, weight=1.0 → score=100
        assert result.score == 100

    def test_only_checkin_present(self) -> None:
        """Only checkin data, no health metrics."""
        checkin = UserCheckin(soreness=3, stress=3, sleep_quality=3)
        result = compute_readiness(HealthMetrics(), checkin, Baselines())
        assert result.score is not None
        assert result.factors_present == 3
        # All mid-range → ~50
        assert 40 <= result.score <= 60

    def test_hrv_needs_min_baseline_days(self) -> None:
        """HRV factor should be absent if baseline has < MIN_BASELINE_DAYS."""
        health = HealthMetrics(hrv_ms=60.0, sleep_duration_hours=7.0)
        baselines = Baselines(hrv_mean=60.0, resting_hr_mean=None, hrv_data_days=3, resting_hr_data_days=0)
        result = compute_readiness(health, None, baselines)
        hrv_factor = next(f for f in result.factors if f.name == "hrv_trend")
        assert hrv_factor.present is False
        # Only sleep_duration should be present
        assert result.factors_present == 1

    def test_rhr_needs_min_baseline_days(self) -> None:
        """RHR factor should be absent if baseline has < MIN_BASELINE_DAYS."""
        health = HealthMetrics(resting_hr_bpm=60.0, sleep_duration_hours=7.0)
        baselines = Baselines(hrv_mean=None, resting_hr_mean=60.0, hrv_data_days=0, resting_hr_data_days=5)
        result = compute_readiness(health, None, baselines)
        rhr_factor = next(f for f in result.factors if f.name == "resting_hr_trend")
        assert rhr_factor.present is False

    def test_factors_total_always_6(self) -> None:
        """factors_total is always 6 regardless of how many are present."""
        result = compute_readiness(HealthMetrics(sleep_duration_hours=7.0), None, Baselines())
        assert result.factors_total == 6

    def test_effective_weights_sum_to_one(self) -> None:
        """Effective weights of present factors should sum to ~1.0."""
        health = HealthMetrics(hrv_ms=60.0, sleep_duration_hours=7.0)
        baselines = _baselines()
        result = compute_readiness(health, None, baselines)
        present_ew = sum(f.effective_weight for f in result.factors if f.present)
        assert present_ew == pytest.approx(1.0)

    def test_absent_factors_have_zero_effective_weight(self) -> None:
        """Absent factors should have effective_weight = 0."""
        result = compute_readiness(HealthMetrics(sleep_duration_hours=7.0), None, Baselines())
        for f in result.factors:
            if not f.present:
                assert f.effective_weight == 0.0

    def test_nan_health_metrics_treated_as_absent(self) -> None:
        """NaN values in health metrics should be treated as absent."""
        health = HealthMetrics(hrv_ms=float("nan"), sleep_duration_hours=float("nan"))
        result = compute_readiness(health, None, _baselines())
        assert result.score is None
        assert result.factors_present == 0

    def test_mid_range_score(self) -> None:
        """Mid-range inputs should produce a score around 50."""
        health = HealthMetrics(hrv_ms=60.0, resting_hr_bpm=60.0, sleep_duration_hours=6.0)
        checkin = UserCheckin(soreness=3, stress=3, sleep_quality=3)
        baselines = _baselines()
        result = compute_readiness(health, checkin, baselines)
        assert result.score is not None
        assert 40 <= result.score <= 60

    def test_custom_weights(self) -> None:
        """Custom weights should be respected."""
        health = HealthMetrics(sleep_duration_hours=8.0)
        checkin = UserCheckin(soreness=1, stress=1, sleep_quality=5)
        # Give sleep_duration 100% weight
        weights = ReadinessWeights(
            hrv_trend=0.0, resting_hr_trend=0.0, sleep_duration=1.0,
            sleep_quality=0.0, soreness=0.0, stress=0.0,
        )
        result = compute_readiness(health, checkin, Baselines(), weights)
        # sleep_duration=8h → norm=1.0, weight=1.0 → score=100
        assert result.score == 100

    def test_score_is_integer(self) -> None:
        """Score should always be an integer (or None)."""
        health = HealthMetrics(sleep_duration_hours=6.5)
        result = compute_readiness(health, None, Baselines())
        assert result.score is None or isinstance(result.score, int)

    def test_factor_names_are_correct(self) -> None:
        """All 6 expected factor names should be present."""
        result = compute_readiness(HealthMetrics(), None, Baselines())
        names = {f.name for f in result.factors}
        expected = {"hrv_trend", "resting_hr_trend", "sleep_duration", "sleep_quality", "soreness", "stress"}
        assert names == expected

    def test_normalized_values_in_range(self) -> None:
        """All normalized values should be in [0.0, 1.0]."""
        health = HealthMetrics(hrv_ms=45.0, resting_hr_bpm=75.0, sleep_duration_hours=5.5)
        checkin = UserCheckin(soreness=2, stress=4, sleep_quality=3)
        baselines = _baselines()
        result = compute_readiness(health, checkin, baselines)
        for f in result.factors:
            assert 0.0 <= f.normalized <= 1.0, f"Factor {f.name} normalized={f.normalized} out of range"
