"""Recomp Engine — Pure, deterministic computation of recomp metrics and targets.

No side effects, no database access. Given identical inputs, produces identical outputs.
"""

from __future__ import annotations
from typing import Optional

import logging
import math
from dataclasses import dataclass
from datetime import date, timedelta

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class MeasurementPoint:
    date: date
    value: float


@dataclass(frozen=True)
class TrendResult:
    slope_per_week: float
    direction: str  # "decreasing" | "stable" | "increasing"
    data_points: int


@dataclass(frozen=True)
class RecompMetricsInput:
    waist_measurements: list[MeasurementPoint]
    arm_measurements: list[MeasurementPoint]
    chest_measurements: list[MeasurementPoint]
    bodyweight_history: list[MeasurementPoint]
    lookback_days: int = 28


@dataclass(frozen=True)
class RecompMetricsOutput:
    waist_trend: Optional[TrendResult]
    arm_trend: Optional[TrendResult]
    chest_trend: Optional[TrendResult]
    weight_trend: Optional[TrendResult]
    muscle_gain_indicator: Optional[float]
    fat_loss_indicator: Optional[float]
    recomp_score: Optional[float]
    has_sufficient_data: bool


@dataclass(frozen=True)
class RecompDailyInput:
    tdee: float
    is_training_day: bool
    weight_kg: float
    baseline_protein_g: float
    baseline_carbs_g: float
    baseline_fat_g: float
    surplus_pct: float = 0.10
    deficit_pct: float = -0.10


@dataclass(frozen=True)
class RecompDailyOutput:
    adjusted_calories: float
    adjusted_protein_g: float
    adjusted_carbs_g: float
    adjusted_fat_g: float
    is_training_day: bool
    calorie_delta: float


@dataclass(frozen=True)
class RecompCheckinInput:
    recomp_metrics: RecompMetricsOutput
    weekly_weight_change_kg: Optional[float]
    current_training_day_surplus_pct: float
    current_rest_day_deficit_pct: float


@dataclass(frozen=True)
class RecompCheckinOutput:
    recommendation: str
    recomp_score: Optional[float]
    suggested_surplus_adjustment: Optional[float]
    suggested_deficit_adjustment: Optional[float]


# ---------------------------------------------------------------------------
# Trend computation (linear regression)
# ---------------------------------------------------------------------------

def compute_trend(points: list[MeasurementPoint]) -> Optional[TrendResult]:
    """Compute linear regression trend from measurement points.

    Returns None if fewer than 2 points or if any values are NaN/Inf.
    Returns slope=0.0/direction="stable" if all dates are identical.
    """
    if len(points) < 2:
        return None

    # Filter out NaN/Inf values
    valid_points = [p for p in points if math.isfinite(p.value)]
    if len(valid_points) < 2:
        logger.warning("Fewer than 2 valid measurement points after NaN/Inf filtering")
        return None

    min_date = min(p.date for p in valid_points)
    xs = [(p.date - min_date).days for p in valid_points]
    ys = [p.value for p in valid_points]
    n = len(xs)

    x_mean = sum(xs) / n
    y_mean = sum(ys) / n

    numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
    denominator = sum((x - x_mean) ** 2 for x in xs)

    if denominator == 0:
        return TrendResult(slope_per_week=0.0, direction="stable", data_points=n)

    slope_per_day = numerator / denominator
    slope_per_week = slope_per_day * 7.0

    # Guard against NaN from computation
    if not math.isfinite(slope_per_week):
        logger.warning("Non-finite slope computed, returning stable trend")
        return TrendResult(slope_per_week=0.0, direction="stable", data_points=n)

    if slope_per_week < -0.05:
        direction = "decreasing"
    elif slope_per_week > 0.05:
        direction = "increasing"
    else:
        direction = "stable"

    return TrendResult(slope_per_week=slope_per_week, direction=direction, data_points=n)


# ---------------------------------------------------------------------------
# Recomp score computation
# ---------------------------------------------------------------------------

def _filter_lookback(points: list[MeasurementPoint], lookback_days: int) -> list[MeasurementPoint]:
    """Filter points to those within lookback_days of the max date."""
    if not points:
        return []
    max_date = max(p.date for p in points)
    cutoff = max_date - timedelta(days=lookback_days)
    return [p for p in points if p.date >= cutoff]


def compute_recomp_score(inp: RecompMetricsInput) -> RecompMetricsOutput:
    """Compute recomp metrics from measurement data."""
    waist_pts = _filter_lookback(inp.waist_measurements, inp.lookback_days)
    arm_pts = _filter_lookback(inp.arm_measurements, inp.lookback_days)
    chest_pts = _filter_lookback(inp.chest_measurements, inp.lookback_days)
    weight_pts = _filter_lookback(inp.bodyweight_history, inp.lookback_days)

    waist_trend = compute_trend(waist_pts)
    arm_trend = compute_trend(arm_pts)
    chest_trend = compute_trend(chest_pts)
    weight_trend = compute_trend(weight_pts)

    # Fat loss indicator: positive when waist is shrinking
    fat_loss_indicator: Optional[float] = None
    if waist_trend is not None:
        fat_loss_indicator = -waist_trend.slope_per_week

    # Muscle gain indicator: average of arm and chest slopes
    muscle_gain_indicator: Optional[float] = None
    slopes = []
    if arm_trend is not None:
        slopes.append(arm_trend.slope_per_week)
    if chest_trend is not None:
        slopes.append(chest_trend.slope_per_week)
    if slopes:
        muscle_gain_indicator = sum(slopes) / len(slopes)

    # Recomp score
    recomp_score: Optional[float] = None
    has_sufficient_data = fat_loss_indicator is not None and muscle_gain_indicator is not None

    if has_sufficient_data:
        try:
            normalized_fat = math.tanh(fat_loss_indicator / 0.5)  # type: ignore[operator]
            normalized_muscle = math.tanh(muscle_gain_indicator / 0.3)  # type: ignore[operator]
            raw_score = 50.0 * normalized_fat + 50.0 * normalized_muscle
            if not math.isfinite(raw_score):
                logger.warning("Non-finite recomp score computed, defaulting to 0.0")
                recomp_score = 0.0
            else:
                recomp_score = max(-100.0, min(100.0, raw_score))
        except (ZeroDivisionError, ValueError, OverflowError):
            logger.exception("Error computing recomp score")
            recomp_score = 0.0

    return RecompMetricsOutput(
        waist_trend=waist_trend,
        arm_trend=arm_trend,
        chest_trend=chest_trend,
        weight_trend=weight_trend,
        muscle_gain_indicator=muscle_gain_indicator,
        fat_loss_indicator=fat_loss_indicator,
        recomp_score=recomp_score,
        has_sufficient_data=has_sufficient_data,
    )


# ---------------------------------------------------------------------------
# Calorie cycling computation
# ---------------------------------------------------------------------------

MIN_CALORIES = 1200.0
MIN_CARBS_G = 50.0
MIN_FAT_G = 20.0
CARB_SHIFT_RATIO = 0.6


def compute_recomp_daily_targets(inp: RecompDailyInput) -> RecompDailyOutput:
    """Compute day-specific calorie and macro targets for recomp mode."""
    if inp.tdee <= 0:
        raise ValueError("TDEE must be positive")
    if inp.weight_kg <= 0:
        raise ValueError("Weight must be positive")

    modifier = inp.surplus_pct if inp.is_training_day else inp.deficit_pct
    adjusted_calories = max(inp.tdee * (1.0 + modifier), MIN_CALORIES)
    calorie_delta = adjusted_calories - inp.tdee

    # Protein floor: 2.0 g/kg
    protein_g = max(inp.baseline_protein_g, 2.0 * inp.weight_kg)

    # Macro distribution based on day type
    if inp.is_training_day and calorie_delta > 0:
        carb_extra_cals = calorie_delta * CARB_SHIFT_RATIO
        carb_extra_g = carb_extra_cals / 4.0
        fat_delta_cals = calorie_delta - carb_extra_cals
        fat_extra_g = fat_delta_cals / 9.0
        carbs_g = max(inp.baseline_carbs_g + carb_extra_g, MIN_CARBS_G)
        fat_g = max(inp.baseline_fat_g + fat_extra_g, MIN_FAT_G)
    elif not inp.is_training_day and calorie_delta < 0:
        carb_reduction_cals = abs(calorie_delta) * CARB_SHIFT_RATIO
        carb_reduction_g = carb_reduction_cals / 4.0
        fat_delta_cals = calorie_delta + carb_reduction_cals
        fat_reduction_g = abs(fat_delta_cals) / 9.0
        carbs_g = max(inp.baseline_carbs_g - carb_reduction_g, MIN_CARBS_G)
        fat_g = max(inp.baseline_fat_g - fat_reduction_g, MIN_FAT_G)
    else:
        carbs_g = max(inp.baseline_carbs_g, MIN_CARBS_G)
        fat_g = max(inp.baseline_fat_g, MIN_FAT_G)

    return RecompDailyOutput(
        adjusted_calories=round(adjusted_calories, 2),
        adjusted_protein_g=round(protein_g, 2),
        adjusted_carbs_g=round(carbs_g, 2),
        adjusted_fat_g=round(fat_g, 2),
        is_training_day=inp.is_training_day,
        calorie_delta=round(calorie_delta, 2),
    )


# ---------------------------------------------------------------------------
# Check-in decision tree
# ---------------------------------------------------------------------------

def compute_recomp_checkin(inp: RecompCheckinInput) -> RecompCheckinOutput:
    """Generate recomp check-in recommendation using priority-ordered decision tree."""
    metrics = inp.recomp_metrics
    score = metrics.recomp_score

    # Branch 1: Insufficient data
    if not metrics.has_sufficient_data:
        return RecompCheckinOutput(
            recommendation="Log body measurements to get recomp recommendations",
            recomp_score=score,
            suggested_surplus_adjustment=None,
            suggested_deficit_adjustment=None,
        )

    # Branch 2: Weight dropping too fast
    if inp.weekly_weight_change_kg is not None and inp.weekly_weight_change_kg < -0.5:
        return RecompCheckinOutput(
            recommendation="Weight dropping too fast — increase training day calories",
            recomp_score=score,
            suggested_surplus_adjustment=0.02,
            suggested_deficit_adjustment=None,
        )

    # Branch 3: Weight gaining too fast
    if inp.weekly_weight_change_kg is not None and inp.weekly_weight_change_kg > 0.5:
        return RecompCheckinOutput(
            recommendation="Weight gaining too fast — decrease rest day calories",
            recomp_score=score,
            suggested_surplus_adjustment=None,
            suggested_deficit_adjustment=-0.02,
        )

    # Branch 4: Recomp is working
    waist_t = metrics.waist_trend
    arm_t = metrics.arm_trend
    chest_t = metrics.chest_trend
    if (
        waist_t is not None
        and waist_t.direction == "decreasing"
        and (
            (arm_t is not None and arm_t.direction == "increasing")
            or (chest_t is not None and chest_t.direction == "increasing")
        )
    ):
        waist_change = abs(waist_t.slope_per_week)
        muscle_change = 0.0
        if arm_t and arm_t.direction == "increasing":
            muscle_change = arm_t.slope_per_week
        elif chest_t and chest_t.direction == "increasing":
            muscle_change = chest_t.slope_per_week
        return RecompCheckinOutput(
            recommendation=f"Waist down {waist_change:.1f}cm/wk, arms up {muscle_change:.1f}cm/wk — recomp is working",
            recomp_score=score,
            suggested_surplus_adjustment=None,
            suggested_deficit_adjustment=None,
        )

    # Branch 5: Waist increasing
    if waist_t is not None and waist_t.direction == "increasing":
        return RecompCheckinOutput(
            recommendation="Waist increasing — consider reducing rest day calories",
            recomp_score=score,
            suggested_surplus_adjustment=None,
            suggested_deficit_adjustment=-0.02,
        )

    # Branch 6: Default
    return RecompCheckinOutput(
        recommendation="No significant changes yet — stay consistent and keep logging",
        recomp_score=score,
        suggested_surplus_adjustment=None,
        suggested_deficit_adjustment=None,
    )
