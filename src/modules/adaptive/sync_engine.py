"""Nutrition-Training Sync Engine — Pure, deterministic daily target computation.

Given baseline adaptive targets and training session data, produces day-specific
adjusted calorie and macro targets. No side effects, no database access.
"""

from __future__ import annotations

from dataclasses import dataclass

from src.modules.training.exercise_mapping import get_muscle_group, is_compound
from src.shared.types import TrainingPhase

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_TRAINING_SURPLUS_PCT = 0.15
DEFAULT_REST_MODIFIER_PCT = -0.05
VOLUME_MULTIPLIER_MIN = 0.7
VOLUME_MULTIPLIER_MAX = 1.5
MIN_CARBS_G = 50.0
MIN_FAT_G = 20.0
PHASE_ACCUMULATION_BONUS = 0.05
COMPOUND_BONUS_PER_EXERCISE = 0.03
COMPOUND_BONUS_CAP = 0.15

MUSCLE_GROUP_DEMAND_WEIGHTS: dict[str, float] = {
    "quads": 0.15,
    "hamstrings": 0.15,
    "glutes": 0.15,
    "calves": 0.15,
    "back": 0.10,
    "chest": 0.08,
    "shoulders": 0.06,
    "biceps": 0.03,
    "triceps": 0.03,
    "forearms": 0.03,
    "abs": 0.02,
    "traps": 0.02,
}


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class SessionExercise:
    exercise_name: str
    muscle_group: str
    is_compound: bool
    total_sets: int
    total_reps: int
    total_volume: float  # reps × weight summed across sets


@dataclass(frozen=True)
class DailyTargetInput:
    baseline_calories: float
    baseline_protein_g: float
    baseline_carbs_g: float
    baseline_fat_g: float
    is_training_day: bool
    session_exercises: list[SessionExercise]
    session_volume: float
    rolling_avg_volume: float
    training_phase: TrainingPhase
    training_day_surplus_pct: float = DEFAULT_TRAINING_SURPLUS_PCT
    rest_day_modifier_pct: float = DEFAULT_REST_MODIFIER_PCT


@dataclass(frozen=True)
class DailyTargetOutput:
    adjusted_calories: float
    adjusted_protein_g: float
    adjusted_carbs_g: float
    adjusted_fat_g: float
    day_classification: str
    muscle_group_demand: float
    volume_multiplier: float
    phase_modifier: float
    calorie_delta: float
    explanation: str


# ---------------------------------------------------------------------------
# Pure computation functions
# ---------------------------------------------------------------------------

def compute_muscle_group_demand(exercises: list[SessionExercise]) -> float:
    """Compute muscle group demand score (0.0–1.0) from session exercises."""
    if not exercises:
        return 0.0

    seen_groups: set[str] = set()
    score = 0.0
    compound_count = 0

    for ex in exercises:
        group = ex.muscle_group.lower()
        if group not in seen_groups:
            seen_groups.add(group)
            score += MUSCLE_GROUP_DEMAND_WEIGHTS.get(group, 0.0)
        if ex.is_compound:
            compound_count += 1

    compound_bonus = min(compound_count * COMPOUND_BONUS_PER_EXERCISE, COMPOUND_BONUS_CAP)
    return min(score + compound_bonus, 1.0)


def compute_volume_multiplier(session_volume: float, rolling_avg_volume: float) -> float:
    """Compute volume multiplier clamped to [0.7, 1.5]."""
    if rolling_avg_volume <= 0 or session_volume <= 0:
        return 1.0
    raw_ratio = session_volume / rolling_avg_volume
    return max(VOLUME_MULTIPLIER_MIN, min(VOLUME_MULTIPLIER_MAX, raw_ratio))


def compute_session_volume(exercises: list[SessionExercise]) -> float:
    """Sum total_volume across all exercises."""
    return sum(ex.total_volume for ex in exercises)


def compute_daily_targets(inp: DailyTargetInput) -> DailyTargetOutput:
    """Pure, deterministic computation of daily adjusted targets."""
    # Step 1: Day classification
    classification = "training_day" if inp.is_training_day else "rest_day"

    # Step 2: Muscle group demand
    demand = compute_muscle_group_demand(inp.session_exercises) if inp.is_training_day else 0.0

    # Step 3: Volume multiplier
    vol_mult = compute_volume_multiplier(inp.session_volume, inp.rolling_avg_volume) if inp.is_training_day else 1.0

    # Step 4: Calorie adjustment
    if inp.is_training_day:
        surplus = inp.baseline_calories * inp.training_day_surplus_pct * vol_mult
    else:
        surplus = inp.baseline_calories * inp.rest_day_modifier_pct

    # Step 5: Phase modifier
    if inp.training_phase == TrainingPhase.ACCUMULATION:
        phase_mod = 1.0 + PHASE_ACCUMULATION_BONUS
    elif inp.training_phase == TrainingPhase.DELOAD:
        phase_mod = 0.0  # zero out surplus
    else:
        phase_mod = 1.0

    if inp.is_training_day:
        calorie_delta = surplus * phase_mod
    else:
        calorie_delta = surplus  # rest day not affected by phase

    # Step 6: Macro distribution
    adjusted_calories = inp.baseline_calories + calorie_delta
    adjusted_protein_g = inp.baseline_protein_g  # never reduced

    if calorie_delta != 0:
        carb_ratio = 0.5 + 0.3 * demand
        carb_extra_cals = calorie_delta * carb_ratio
        carb_extra_g = carb_extra_cals / 4.0
        fat_extra_cals = calorie_delta - carb_extra_cals
        fat_extra_g = fat_extra_cals / 9.0
    else:
        carb_extra_g = 0.0
        fat_extra_g = 0.0

    adjusted_carbs_g = max(inp.baseline_carbs_g + carb_extra_g, MIN_CARBS_G)
    adjusted_fat_g = max(inp.baseline_fat_g + fat_extra_g, MIN_FAT_G)

    # Step 7: Explanation
    parts: list[str] = []
    if inp.is_training_day:
        groups = {ex.muscle_group.lower() for ex in inp.session_exercises}
        leg_groups = groups & {"quads", "hamstrings", "glutes", "calves"}
        if leg_groups:
            parts.append("Leg day")
        elif groups:
            parts.append("Training day")
        else:
            parts.append("Training day")
    else:
        parts.append("Rest day")

    delta_sign = "+" if calorie_delta >= 0 else ""
    parts.append(f"{delta_sign}{round(calorie_delta)} kcal")

    if inp.is_training_day and vol_mult != 1.0:
        parts.append(f"Volume {vol_mult:.1f}×")

    if inp.training_phase != TrainingPhase.NONE:
        parts.append(inp.training_phase.value.capitalize())

    explanation = " · ".join(parts)

    return DailyTargetOutput(
        adjusted_calories=round(adjusted_calories, 2),
        adjusted_protein_g=round(adjusted_protein_g, 2),
        adjusted_carbs_g=round(adjusted_carbs_g, 2),
        adjusted_fat_g=round(adjusted_fat_g, 2),
        day_classification=classification,
        muscle_group_demand=round(demand, 4),
        volume_multiplier=round(vol_mult, 4),
        phase_modifier=round(phase_mod, 4),
        calorie_delta=round(calorie_delta, 2),
        explanation=explanation,
    )
