"""
Adaptive Engine — Pure, deterministic computation of caloric and macro targets.

Implements the formal specification from the design document:
  Step 1: BMR (Mifflin-St Jeor)
  Step 2: TDEE (activity multiplier)
  Step 3: EMA smoothing for bodyweight trend
  Step 4: Adaptive caloric adjustment
  Step 5: Macro distribution

No side effects, no database access. Given identical inputs, produces identical outputs.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal, Optional

from src.shared.types import ActivityLevel, GoalType


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ACTIVITY_MULTIPLIERS: dict[ActivityLevel, float] = {
    ActivityLevel.SEDENTARY: 1.2,
    ActivityLevel.LIGHT: 1.375,
    ActivityLevel.MODERATE: 1.55,
    ActivityLevel.ACTIVE: 1.725,
    ActivityLevel.VERY_ACTIVE: 1.9,
}

GOAL_OFFSETS: dict[GoalType, float] = {
    GoalType.CUTTING: -500.0,
    GoalType.MAINTAINING: 0.0,
    GoalType.BULKING: 300.0,
    GoalType.RECOMPOSITION: 0.0,
}

PROTEIN_MULTIPLIERS: dict[GoalType, float] = {
    GoalType.CUTTING: 2.2,
    GoalType.MAINTAINING: 1.8,
    GoalType.BULKING: 2.0,
    GoalType.RECOMPOSITION: 2.0,
}

FAT_PERCENTAGE = 0.25  # 25 % of target calories from fat

EMA_WINDOW = 7  # N for EMA smoothing
EMA_ALPHA = 2.0 / (EMA_WINDOW + 1)  # α = 2/(N+1)

ADJUSTMENT_KCAL_PER_KG = 500.0  # kcal adjustment per kg discrepancy
ADJUSTMENT_CLAMP_MIN = -300.0
ADJUSTMENT_CLAMP_MAX = 300.0

MIN_TARGET_CALORIES = 1200.0
MIN_CARBS_G = 50.0

MAX_DAILY_FLUCTUATION_KG = 2.0  # exclude >2 kg/day swings from EMA


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class AdaptiveInput:
    """All inputs required for a single adaptive computation."""

    weight_kg: float
    height_cm: float
    age_years: int
    sex: Literal["male", "female"]
    activity_level: ActivityLevel
    goal_type: GoalType
    goal_rate_per_week: float  # kg/week, e.g. -0.5 for cutting
    bodyweight_history: list[tuple[date, float]]  # (date, weight_kg)
    training_load_score: float  # 0-100


@dataclass(frozen=True)
class AdaptiveOutput:
    """Deterministic outputs of the adaptive computation."""

    target_calories: float
    target_protein_g: float
    target_carbs_g: float
    target_fat_g: float
    ema_current: float
    adjustment_factor: float


# ---------------------------------------------------------------------------
# Step 1: BMR (Mifflin-St Jeor)
# ---------------------------------------------------------------------------

def _compute_bmr(weight_kg: float, height_cm: float, age_years: int, sex: Literal["male", "female"]) -> float:
    """Basal Metabolic Rate via Mifflin-St Jeor equation."""
    base = 10.0 * weight_kg + 6.25 * height_cm - 5.0 * age_years
    if sex == "male":
        return base + 5.0
    return base - 161.0


# ---------------------------------------------------------------------------
# Step 2: TDEE
# ---------------------------------------------------------------------------

def _compute_tdee(bmr: float, activity_level: ActivityLevel) -> float:
    """Total Daily Energy Expenditure = BMR × activity multiplier."""
    return bmr * ACTIVITY_MULTIPLIERS[activity_level]


# ---------------------------------------------------------------------------
# Step 3: EMA smoothing
# ---------------------------------------------------------------------------

def _filter_extreme_fluctuations(
    sorted_history: list[tuple[date, float]],
) -> list[tuple[date, float]]:
    """Remove entries where the day-over-day change exceeds MAX_DAILY_FLUCTUATION_KG.

    The first entry is always kept.  Subsequent entries are dropped if
    |weight - previous_kept_weight| > threshold.
    """
    if len(sorted_history) <= 1:
        return list(sorted_history)

    filtered: list[tuple[date, float]] = [sorted_history[0]]
    for i in range(1, len(sorted_history)):
        prev_weight = filtered[-1][1]
        cur_date, cur_weight = sorted_history[i]
        if abs(cur_weight - prev_weight) <= MAX_DAILY_FLUCTUATION_KG:
            filtered.append((cur_date, cur_weight))
    return filtered


def _compute_ema(sorted_history: list[tuple[date, float]]) -> float:
    """Compute the current EMA value from date-sorted bodyweight history.

    If fewer than EMA_WINDOW entries, returns the simple average instead.
    """
    if not sorted_history:
        raise ValueError("bodyweight_history must not be empty")

    weights = [w for _, w in sorted_history]

    if len(weights) < EMA_WINDOW:
        return sum(weights) / len(weights)

    # Seed EMA with the first value, then iterate
    ema = weights[0]
    for w in weights[1:]:
        ema = EMA_ALPHA * w + (1.0 - EMA_ALPHA) * ema
    return ema


def _compute_ema_n_days_ago(
    sorted_history: list[tuple[date, float]],
    n_days: int = 7,
) -> Optional[float]:
    """Compute EMA as of *n_days* ago.

    Returns ``None`` if there aren't enough data points before that cutoff.
    """
    if len(sorted_history) < 2:
        return None

    latest_date = sorted_history[-1][0]
    cutoff = latest_date  # we want entries up to n_days before latest
    # Build sub-history ending n_days before the latest entry
    sub = [(d, w) for d, w in sorted_history if (latest_date - d).days >= n_days]
    if not sub:
        return None

    weights = [w for _, w in sub]
    if len(weights) < EMA_WINDOW:
        return sum(weights) / len(weights)

    ema = weights[0]
    for w in weights[1:]:
        ema = EMA_ALPHA * w + (1.0 - EMA_ALPHA) * ema
    return ema


# ---------------------------------------------------------------------------
# Step 4: Adaptive adjustment
# ---------------------------------------------------------------------------

def _compute_adjustment(
    ema_current: float,
    ema_7_days_ago: Optional[float],
    expected_weekly_change: float,
) -> float:
    """Compute the adaptive caloric adjustment, clamped to safe bounds."""
    if ema_7_days_ago is None:
        return 0.0

    weekly_weight_change = ema_current - ema_7_days_ago
    raw = (expected_weekly_change - weekly_weight_change) * ADJUSTMENT_KCAL_PER_KG
    return max(ADJUSTMENT_CLAMP_MIN, min(ADJUSTMENT_CLAMP_MAX, raw))


# ---------------------------------------------------------------------------
# Step 5: Macro distribution
# ---------------------------------------------------------------------------

def _compute_macros(
    weight_kg: float,
    target_calories: float,
    goal_type: GoalType,
) -> tuple[float, float, float]:
    """Return (protein_g, fat_g, carbs_g).

    If carbs would be negative, floor at MIN_CARBS_G and adjust
    target_calories upward (returned via the carbs_g value — caller
    must reconcile).
    """
    protein_g = weight_kg * PROTEIN_MULTIPLIERS[goal_type]
    fat_g = target_calories * FAT_PERCENTAGE / 9.0
    carbs_g = (target_calories - protein_g * 4.0 - fat_g * 9.0) / 4.0

    if carbs_g < MIN_CARBS_G:
        carbs_g = MIN_CARBS_G

    return protein_g, fat_g, carbs_g


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_snapshot(input: AdaptiveInput) -> AdaptiveOutput:
    """Pure, deterministic computation of caloric and macro targets.

    Given identical ``AdaptiveInput`` values this function will always
    produce the same ``AdaptiveOutput``.  It performs no I/O and has no
    side effects.
    """

    # Step 1 — BMR
    bmr = _compute_bmr(input.weight_kg, input.height_cm, input.age_years, input.sex)

    # Step 2 — TDEE
    tdee = _compute_tdee(bmr, input.activity_level)

    # Step 3 — EMA smoothing
    sorted_history = sorted(input.bodyweight_history, key=lambda t: t[0])
    filtered_history = _filter_extreme_fluctuations(sorted_history)

    # Use filtered history for EMA; fall back to unfiltered if filtering
    # removed everything (shouldn't happen, but be safe).
    history_for_ema = filtered_history if filtered_history else sorted_history

    ema_current = _compute_ema(history_for_ema)
    ema_7_days_ago = _compute_ema_n_days_ago(history_for_ema, n_days=7)

    # Step 4 — Adaptive adjustment
    adjustment_factor = _compute_adjustment(
        ema_current,
        ema_7_days_ago,
        expected_weekly_change=input.goal_rate_per_week,
    )

    goal_offset = GOAL_OFFSETS[input.goal_type]
    target_calories = tdee + goal_offset + adjustment_factor

    # Enforce minimum calories
    if target_calories < MIN_TARGET_CALORIES:
        target_calories = MIN_TARGET_CALORIES

    # Step 5 — Macro distribution
    protein_g, fat_g, carbs_g = _compute_macros(
        input.weight_kg, target_calories, input.goal_type,
    )

    # If carbs were floored, reconcile target_calories upward
    actual_calories_from_macros = protein_g * 4.0 + fat_g * 9.0 + carbs_g * 4.0
    if actual_calories_from_macros > target_calories:
        target_calories = actual_calories_from_macros

    return AdaptiveOutput(
        target_calories=round(target_calories, 2),
        target_protein_g=round(protein_g, 2),
        target_carbs_g=round(carbs_g, 2),
        target_fat_g=round(fat_g, 2),
        ema_current=round(ema_current, 4),
        adjustment_factor=round(adjustment_factor, 2),
    )
