"""Fatigue Detection Engine — pure computation functions.

All functions are deterministic with zero side effects.
No database or I/O dependencies.
"""

from __future__ import annotations
from typing import Optional

from dataclasses import dataclass, field
from datetime import date


@dataclass(frozen=True)
class SetData:
    reps: int
    weight_kg: float
    rpe: Optional[float] = None


@dataclass(frozen=True)
class SessionExerciseData:
    session_date: date
    exercise_name: str
    sets: list[SetData]


@dataclass(frozen=True)
class ExerciseE1RM:
    session_date: date
    exercise_name: str
    best_e1rm: float
    best_weight_kg: float
    best_reps: int


@dataclass(frozen=True)
class RegressionSignal:
    exercise_name: str
    muscle_group: str
    consecutive_declines: int
    peak_e1rm: float
    current_e1rm: float
    decline_pct: float


@dataclass(frozen=True)
class FatigueScoreResult:
    muscle_group: str
    score: float
    regression_component: float
    volume_component: float
    frequency_component: float
    nutrition_component: float


@dataclass(frozen=True)
class DeloadSuggestion:
    muscle_group: str
    fatigue_score: float
    top_regressed_exercise: str
    decline_pct: float
    decline_sessions: int
    message: str


@dataclass(frozen=True)
class FatigueConfig:
    regression_weight: float = 0.35
    volume_weight: float = 0.30
    frequency_weight: float = 0.20
    nutrition_weight: float = 0.15
    fatigue_threshold: float = 70.0
    min_sessions_for_regression: int = 2
    lookback_days: int = 28


MRV_SETS_PER_WEEK: dict[str, int] = {
    "chest": 22, "back": 22, "lats": 22, "erectors": 18, "adductors": 16,
    "shoulders": 22, "quads": 20,
    "hamstrings": 16, "glutes": 16, "biceps": 20, "triceps": 18,
    "calves": 16, "abs": 20, "traps": 16, "forearms": 16,
}


def compute_e1rm(weight_kg: float, reps: int) -> float:
    """Epley formula. Returns 0 for non-positive weight/reps or NaN inputs."""
    if (
        not isinstance(weight_kg, (int, float))
        or not isinstance(reps, (int, float))
    ):
        return 0.0
    # Guard against NaN / Inf
    if weight_kg != weight_kg or reps != reps:  # NaN check without math import
        return 0.0
    if weight_kg <= 0 or reps <= 0:
        return 0.0
    return weight_kg * (1 + reps / 30)


def compute_best_e1rm_per_session(
    sessions: list[SessionExerciseData],
) -> dict[str, list[ExerciseE1RM]]:
    """Group by exercise (case-insensitive), best e1RM per session, sorted by date.

    Returns empty dict for empty input. Skips exercises with blank names.
    """
    if not sessions:
        return {}

    from collections import defaultdict

    grouped: dict[str, dict[date, list[SetData]]] = defaultdict(lambda: defaultdict(list))
    for s in sessions:
        key = s.exercise_name.lower().strip()
        if not key:
            continue
        grouped[key][s.session_date].extend(s.sets)

    result: dict[str, list[ExerciseE1RM]] = {}
    for ex_name, date_sets in grouped.items():
        points: list[ExerciseE1RM] = []
        for session_date, sets in date_sets.items():
            best_e1rm = 0.0
            best_w = 0.0
            best_r = 0
            for s in sets:
                e = compute_e1rm(s.weight_kg, s.reps)
                if e > best_e1rm:
                    best_e1rm = e
                    best_w = s.weight_kg
                    best_r = s.reps
            if best_e1rm > 0:
                points.append(ExerciseE1RM(
                    session_date=session_date,
                    exercise_name=ex_name,
                    best_e1rm=best_e1rm,
                    best_weight_kg=best_w,
                    best_reps=best_r,
                ))
        result[ex_name] = sorted(points, key=lambda p: p.session_date)
    return result


def detect_regressions(
    e1rm_series: dict[str, list[ExerciseE1RM]],
    min_consecutive: int = 2,
) -> list[RegressionSignal]:
    """Detect exercises with N+ consecutive e1RM declines.

    Returns empty list for empty input or when min_consecutive < 1.
    """
    if not e1rm_series or min_consecutive < 1:
        return []

    from src.modules.training.exercise_mapping import get_muscle_group

    signals: list[RegressionSignal] = []
    for ex_name, points in e1rm_series.items():
        if len(points) < 2:
            continue
        # Find longest tail of consecutive declines
        consecutive = 0
        peak = points[0].best_e1rm
        for i in range(1, len(points)):
            if points[i].best_e1rm < points[i - 1].best_e1rm:
                consecutive += 1
            else:
                consecutive = 0
                peak = points[i].best_e1rm
            # Update peak if current is higher
            if points[i].best_e1rm > peak:
                peak = points[i].best_e1rm

        if consecutive >= min_consecutive:
            current = points[-1].best_e1rm
            # Find the peak before the decline streak started
            decline_start_idx = len(points) - consecutive - 1
            if decline_start_idx >= 0:
                peak = points[decline_start_idx].best_e1rm
            decline_pct = ((peak - current) / peak * 100) if peak > 0 else 0.0
            signals.append(RegressionSignal(
                exercise_name=ex_name,
                muscle_group=get_muscle_group(ex_name),
                consecutive_declines=consecutive,
                peak_e1rm=peak,
                current_e1rm=current,
                decline_pct=decline_pct,
            ))
    return signals


def compute_nutrition_compliance(
    total_calories: float,
    target_calories: float,
) -> float:
    """Return ratio clamped to [0, 2.0]. Returns 1.0 if target <= 0 or inputs invalid."""
    if (
        not isinstance(total_calories, (int, float))
        or not isinstance(target_calories, (int, float))
    ):
        return 1.0
    # NaN guard
    if total_calories != total_calories or target_calories != target_calories:
        return 1.0
    if target_calories <= 0:
        return 1.0
    if total_calories < 0:
        return 0.0
    return max(0.0, min(total_calories / target_calories, 2.0))


def compute_fatigue_score(
    muscle_group: str,
    regressions: list[RegressionSignal],
    weekly_sets: int,
    mrv_sets: int,
    weekly_frequency: int,
    nutrition_compliance: Optional[float],
    config: FatigueConfig = FatigueConfig(),
) -> FatigueScoreResult:
    """Compute fatigue score for one muscle group. Clamped to [0, 100].

    Safely handles negative inputs and zero MRV.
    """
    # Clamp negative inputs to 0
    weekly_sets = max(int(weekly_sets), 0)
    mrv_sets = max(int(mrv_sets), 0)
    weekly_frequency = max(int(weekly_frequency), 0)

    # Regression component: count regressions for this muscle group
    reg_count = sum(1 for r in regressions if r.muscle_group == muscle_group)
    regression_comp = min(reg_count / 3.0, 1.0)

    # Volume component — safe against division by zero
    volume_comp = min(weekly_sets / mrv_sets, 1.0) if mrv_sets > 0 else 0.0

    # Frequency component
    frequency_comp = min(weekly_frequency / 5.0, 1.0)

    # Nutrition component
    if nutrition_compliance is None or nutrition_compliance >= 0.8:
        nutrition_comp = 0.0
    else:
        nutrition_comp = max(0.0, min(1.0 - nutrition_compliance, 1.0))

    raw = (
        config.regression_weight * regression_comp
        + config.volume_weight * volume_comp
        + config.frequency_weight * frequency_comp
        + config.nutrition_weight * nutrition_comp
    )
    score = max(0.0, min(raw * 100, 100.0))

    return FatigueScoreResult(
        muscle_group=muscle_group,
        score=score,
        regression_component=regression_comp,
        volume_component=volume_comp,
        frequency_component=frequency_comp,
        nutrition_component=nutrition_comp,
    )


def generate_suggestions(
    scores: list[FatigueScoreResult],
    regressions: list[RegressionSignal],
    config: FatigueConfig = FatigueConfig(),
) -> list[DeloadSuggestion]:
    """Generate deload suggestions for muscle groups exceeding threshold."""
    suggestions: list[DeloadSuggestion] = []
    for s in scores:
        if s.score <= config.fatigue_threshold:
            continue
        # Find worst regression for this muscle group
        group_regs = [r for r in regressions if r.muscle_group == s.muscle_group]
        if group_regs:
            worst = max(group_regs, key=lambda r: r.decline_pct)
            top_exercise = worst.exercise_name
            decline_pct = worst.decline_pct
            decline_sessions = worst.consecutive_declines
        else:
            top_exercise = "general"
            decline_pct = 0.0
            decline_sessions = 2
        msg = (
            f"Consider deloading {s.muscle_group} — fatigue score {s.score:.0f}/100. "
            f"{top_exercise} declined {decline_pct:.1f}% over {decline_sessions} sessions."
        )
        suggestions.append(DeloadSuggestion(
            muscle_group=s.muscle_group,
            fatigue_score=s.score,
            top_regressed_exercise=top_exercise,
            decline_pct=decline_pct,
            decline_sessions=max(decline_sessions, 2),
            message=msg,
        ))
    return suggestions


def get_fatigue_color(score: float) -> str:
    """Return hex color: green 0-30, yellow 31-60, red 61-100.

    Clamps out-of-range scores before mapping.
    """
    clamped = max(0.0, min(float(score), 100.0))
    if clamped <= 30:
        return "#4CAF50"
    if clamped <= 60:
        return "#FFC107"
    return "#F44336"
