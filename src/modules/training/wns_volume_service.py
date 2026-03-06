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
    WNSWeeklyTrendPoint,
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


def get_volume_multiplier_for_goal(goal_type: str, rate_kg_per_week: float) -> float:
    """Calculate volume multiplier based on calorie balance.
    
    During a deficit, recovery capacity is reduced → lower MRV.
    During a surplus, recovery capacity is enhanced → higher MRV.
    
    Args:
        goal_type: 'cutting', 'bulking', 'maintaining', 'recomposition'
        rate_kg_per_week: Target rate of weight change
        
    Returns:
        Multiplier to apply to all volume landmarks (0.60-1.20 range)
        
    Research basis:
    - Menno Henselmans: 20-33% volume reduction when cutting
    - Murphy & Koehler 2021: 500 kcal deficit fully blunts lean mass gains
    - Helms et al. 2014: 0.5-1% BW/week loss rate for contest prep
    - Slater et al. 2019: Conservative surplus ~360-480 kcal for optimal gains
    """
    if goal_type == 'cutting':
        deficit_kcal = rate_kg_per_week * -1000
        multiplier = 1.0 + (deficit_kcal * 0.0003)
        return max(0.70, multiplier)

    elif goal_type == 'bulking':
        surplus_kcal = rate_kg_per_week * 1000
        multiplier = 1.0 + (surplus_kcal * 0.00025)
        return min(1.20, multiplier)

    elif goal_type == 'recomposition':
        return 0.95

    else:  # 'maintaining'
        return 1.0


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

    async def _compute_trend(
        self, user_id: uuid.UUID, week_start: date,
    ) -> dict[str, list[WNSWeeklyTrendPoint]]:
        """Compute 4-week volume trend per muscle group (hard sets per week)."""
        from src.modules.training.analytics_service import TrainingAnalyticsService
        from src.modules.training.exercise_mapping import get_muscle_group

        trend_start = week_start - timedelta(weeks=3)
        trend_end = week_start + timedelta(days=6)

        svc = TrainingAnalyticsService(self.session)
        rows = await svc._fetch_sessions(user_id, trend_start, trend_end)

        # Aggregate hard sets per (iso_week_monday, muscle_group)
        weekly: dict[str, dict[date, int]] = defaultdict(lambda: defaultdict(int))
        for session_date, exercises in rows:
            week_monday = session_date - timedelta(days=session_date.weekday())
            for ex in exercises:
                mg = get_muscle_group(ex.get("exercise_name", ""))
                if not mg:
                    continue
                for s in ex.get("sets", []):
                    if s.get("set_type", "normal") != "warm-up":
                        weekly[mg][week_monday] += 1

        # Build sorted trend lists for each muscle
        result: dict[str, list[WNSWeeklyTrendPoint]] = {}
        # The 4 week mondays covering the trend window
        four_weeks = [week_start - timedelta(weeks=w) for w in range(3, -1, -1)]

        for mg, week_data in weekly.items():
            result[mg] = [
                WNSWeeklyTrendPoint(week=w, volume=float(week_data.get(w, 0)))
                for w in four_weeks
            ]
        return result

    async def get_weekly_muscle_volume(
        self, user_id: uuid.UUID, week_start: date, goal_type: Optional[str] = None, goal_rate: Optional[float] = None
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
        
        # Calculate volume multiplier based on goal
        volume_multiplier = 1.0
        if goal_type and goal_rate is not None:
            volume_multiplier = get_volume_multiplier_for_goal(goal_type, goal_rate)

        # Compute 4-week trend data
        trend_data = await self._compute_trend(user_id, week_start)

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
            
            # Calculate frequency (unique session dates)
            session_dates = {sd for sd, _ in sessions}
            
            # Apply goal-adjusted landmarks
            adjusted_landmarks = {k: v * volume_multiplier for k, v in lm_dict.items()}
            status = _classify_wns_status(net, adjusted_landmarks, len(session_dates))

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
                    landmarks=WNSLandmarks(**{k: round(v, 1) for k, v in adjusted_landmarks.items()}),
                    exercises=ex_contributions,
                    trend=trend_data.get(mg, []),
                )
            )

        # --- Volume warning notifications (Phase 4) ---
        above_mrv_muscles = [r.muscle_group for r in results if r.status == "above_mrv"]
        if above_mrv_muscles:
            try:
                from sqlalchemy import select, text, cast, String
                from src.modules.notifications.models import NotificationLog
                from src.modules.notifications.service import NotificationService

                notif_svc = NotificationService(self.session)
                for muscle in above_mrv_muscles:
                    # Deduplicate: skip if volume_warning sent for this muscle in past 7 days
                    stmt = select(NotificationLog.id).where(
                        NotificationLog.user_id == user_id,
                        NotificationLog.type == "volume_warning",
                        cast(NotificationLog.data["muscle"], String) == muscle,
                        NotificationLog.sent_at > text("NOW() - INTERVAL '7 days'"),
                    ).limit(1)
                    recent = (await self.session.execute(stmt)).scalar_one_or_none()
                    if recent is not None:
                        continue

                    await notif_svc.send_push(
                        user_id=user_id,
                        title="Volume Warning",
                        body=f"Your {muscle} volume is above MRV",
                        notification_type="volume_warning",
                        data={"screen": "Analytics", "muscle": muscle},
                    )
            except Exception:
                logger.exception("Volume warning notification failed")

        return results