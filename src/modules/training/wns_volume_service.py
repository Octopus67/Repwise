"""WNS Volume Service — computes Weekly Net Stimulus per muscle group."""

from __future__ import annotations

import logging
import uuid
from collections import defaultdict
from datetime import date, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.training.exercise_coefficients import get_muscle_coefficients
from src.modules.training.volume_schemas import (
    VolumeStatus,
    WNSExerciseContribution,
    WNSLandmarks,
    WNSMuscleVolume,
)
from src.modules.training.wns_engine import (
    DEFAULT_MAINTENANCE_SETS,
    DEFAULT_STIMULUS_DURATION_DAYS,
    atrophy_between_sessions,
    diminishing_returns,
    rir_from_rpe,
    stimulating_reps_per_set,
)

logger = logging.getLogger(__name__)

# ─── Default WNS Landmarks (in Hypertrophy Units) ────────────────────────────

DEFAULT_WNS_LANDMARKS: dict[str, dict[str, float]] = {
    "chest":      {"mv": 3, "mev": 8,  "mav_low": 16, "mav_high": 24, "mrv": 35},
    "lats":       {"mv": 3, "mev": 8,  "mav_low": 16, "mav_high": 26, "mrv": 38},
    "back":       {"mv": 3, "mev": 8,  "mav_low": 16, "mav_high": 26, "mrv": 38},
    "erectors":   {"mv": 2, "mev": 5,  "mav_low": 10, "mav_high": 16, "mrv": 25},
    "shoulders":  {"mv": 2, "mev": 6,  "mav_low": 12, "mav_high": 20, "mrv": 28},
    "quads":      {"mv": 3, "mev": 7,  "mav_low": 14, "mav_high": 22, "mrv": 32},
    "hamstrings": {"mv": 2, "mev": 6,  "mav_low": 12, "mav_high": 20, "mrv": 28},
    "glutes":     {"mv": 2, "mev": 6,  "mav_low": 12, "mav_high": 20, "mrv": 30},
    "biceps":     {"mv": 2, "mev": 5,  "mav_low": 10, "mav_high": 16, "mrv": 25},
    "triceps":    {"mv": 2, "mev": 5,  "mav_low": 10, "mav_high": 16, "mrv": 25},
    "calves":     {"mv": 2, "mev": 5,  "mav_low": 10, "mav_high": 16, "mrv": 25},
    "abs":        {"mv": 2, "mev": 5,  "mav_low": 10, "mav_high": 16, "mrv": 25},
    "traps":      {"mv": 2, "mev": 5,  "mav_low": 10, "mav_high": 14, "mrv": 22},
    "forearms":   {"mv": 1, "mev": 4,  "mav_low": 8,  "mav_high": 12, "mrv": 20},
    "adductors":  {"mv": 1, "mev": 4,  "mav_low": 8,  "mav_high": 12, "mrv": 20},
}


def _build_exercise_lookup() -> dict[str, dict]:
    """Build a name→exercise dict from the system exercise catalog."""
    from src.modules.training.exercises import get_all_exercises
    return {ex["name"].lower().strip(): ex for ex in get_all_exercises()}


def _classify_wns_status(net_stimulus: float, landmarks: dict[str, float], frequency: int) -> VolumeStatus:
    """Classify WNS status relative to HU landmarks.
    
    Args:
        net_stimulus: Weekly net stimulus in HU
        landmarks: Landmark thresholds for this muscle
        frequency: Number of sessions per week
        
    Returns:
        Status classification
    """
    # Maintenance zone: 1x/week with moderate volume
    if frequency == 1 and landmarks["mev"] <= net_stimulus <= landmarks["mav_low"]:
        return "optimal"  # Maintenance is considered optimal for 1x/week
    
    if net_stimulus < landmarks["mev"]:
        return "below_mev"
    if net_stimulus <= landmarks["mav_high"]:
        return "optimal"
    if net_stimulus <= landmarks["mrv"]:
        return "approaching_mrv"
    return "above_mrv"


class WNSVolumeService:
    """Computes Weekly Net Stimulus per muscle group from training sessions."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_weekly_muscle_volume(
        self, user_id: uuid.UUID, week_start: date
    ) -> list[WNSMuscleVolume]:
        from src.modules.training.analytics_service import TrainingAnalyticsService

        week_end = week_start + timedelta(days=6)
        svc = TrainingAnalyticsService(self.session)

        try:
            rows = await svc._fetch_sessions(user_id, week_start, week_end)
        except Exception as e:
            logger.exception("Failed to fetch training sessions for user %s", user_id)
            from fastapi import HTTPException
            raise HTTPException(
                status_code=500,
                detail="Failed to calculate volume data. Please try again."
            ) from e

        exercise_lookup = _build_exercise_lookup()

        # Build per-exercise coefficients from catalog
        exercise_coeff_cache: dict[str, dict[str, float]] = {}

        def _get_coefficients(ex_name: str) -> dict[str, float]:
            lower = ex_name.lower().strip()
            if lower not in exercise_coeff_cache:
                ex_info = exercise_lookup.get(lower)
                if ex_info:
                    exercise_coeff_cache[lower] = get_muscle_coefficients(
                        ex_name, ex_info["muscle_group"], ex_info.get("secondary_muscles", [])
                    )
                else:
                    exercise_coeff_cache[lower] = get_muscle_coefficients(ex_name, "", [])
            return exercise_coeff_cache[lower]

        # Collect per-muscle-group, per-session data
        # Structure: {muscle_group: [(session_date, [(stim_reps, coefficient, exercise_name)])]}
        muscle_sessions: dict[str, list[tuple[date, list[tuple[float, float, str]]]]] = defaultdict(list)

        for session_date, exercises in rows:
            # Gather all sets per muscle group for this session
            muscle_sets_this_session: dict[str, list[tuple[float, float, str]]] = defaultdict(list)

            for ex in exercises:
                ex_name = ex.get("exercise_name", "")
                coefficients = _get_coefficients(ex_name)

                for s in ex.get("sets", []):
                    if s.get("set_type", "normal") == "warm-up":
                        continue

                    rpe = s.get("rpe")
                    rir_val = s.get("rir")
                    if rir_val is None and rpe is not None:
                        rir_val = rir_from_rpe(rpe)

                    reps = s.get("reps", 0)
                    weight_kg = s.get("weight_kg", 0.0)
                    # Estimate intensity_pct — we don't have e1rm readily, use None
                    intensity_pct = None

                    stim_reps = stimulating_reps_per_set(reps, rir_val, intensity_pct)

                    for mg, coeff in coefficients.items():
                        if coeff > 0:
                            muscle_sets_this_session[mg].append((stim_reps, coeff, ex_name))

            for mg, sets_list in muscle_sets_this_session.items():
                muscle_sessions[mg].append((session_date, sets_list))

        # Compute WNS for each muscle group
        results: list[WNSMuscleVolume] = []

        for mg, lm_dict in DEFAULT_WNS_LANDMARKS.items():
            sessions = muscle_sessions.get(mg, [])
            sessions.sort(key=lambda x: x[0])

            # Per-session stimulus with diminishing returns
            session_stimuli: list[tuple[date, float]] = []
            # Track per-exercise contributions
            exercise_contrib: dict[str, dict] = defaultdict(lambda: {
                "coefficient": 0.0, "sets_count": 0, "stim_reps_total": 0.0, "hu": 0.0,
            })
            per_session_cap_exceeded = False

            for session_date, sets_list in sessions:
                weighted_stim_reps = [sr * coeff for sr, coeff, _ in sets_list]
                session_stim, exceeds_cap = diminishing_returns(weighted_stim_reps), len(weighted_stim_reps) > 10
                if exceeds_cap:
                    per_session_cap_exceeded = True
                session_stimuli.append((session_date, session_stim))

                # Track exercise contributions (approximate — attribute proportionally)
                total_weighted = sum(weighted_stim_reps) if weighted_stim_reps else 1.0
                for i, (sr, coeff, ex_name) in enumerate(sets_list):
                    ec = exercise_contrib[ex_name]
                    ec["coefficient"] = max(ec["coefficient"], coeff)
                    ec["sets_count"] += 1
                    ec["stim_reps_total"] += sr * coeff
                    # Proportional HU attribution
                    if total_weighted > 0:
                        proportion = (sr * coeff) / total_weighted
                        ec["hu"] += session_stim * proportion

            # Gross stimulus
            gross = sum(s for _, s in session_stimuli)

            # Atrophy between sessions
            total_atrophy = 0.0
            for i in range(1, len(session_stimuli)):
                gap = (session_stimuli[i][0] - session_stimuli[i - 1][0]).days
                total_atrophy += atrophy_between_sessions(float(gap))

            # Atrophy from last session to end of week
            if session_stimuli:
                days_since_last = (week_end - session_stimuli[-1][0]).days
                total_atrophy += atrophy_between_sessions(float(days_since_last))

            net = max(0.0, gross - total_atrophy)
            status = _classify_wns_status(net, lm_dict, len(session_dates))

            # Build exercise contribution list
            ex_contributions = [
                WNSExerciseContribution(
                    exercise_name=ex_name,
                    coefficient=round(data["coefficient"], 2),
                    sets_count=data["sets_count"],
                    stimulating_reps_total=round(data["stim_reps_total"], 1),
                    contribution_hu=round(data["hu"], 1),
                )
                for ex_name, data in exercise_contrib.items()
                if data["sets_count"] > 0
            ]
            ex_contributions.sort(key=lambda x: x.contribution_hu, reverse=True)

            session_dates = {sd for sd, _ in sessions}

            results.append(
                WNSMuscleVolume(
                    muscle_group=mg,
                    gross_stimulus=round(gross, 1),
                    atrophy_effect=round(total_atrophy, 1),
                    net_stimulus=round(net, 1),
                    hypertrophy_units=round(net, 1),
                    status=status,
                    session_count=len(sessions),
                    frequency=len(session_dates),
                    landmarks=WNSLandmarks(**lm_dict),
                    exercises=ex_contributions,
                )
            )

        return results