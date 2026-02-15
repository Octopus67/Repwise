"""Volume Calculator Service — computes weekly effective sets per muscle group."""

from __future__ import annotations
from typing import Optional

import logging
import uuid
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.training.exercise_mapping import get_muscle_group
from src.modules.training.volume_schemas import (
    ExerciseVolumeDetail,
    MuscleGroupDetail,
    MuscleGroupVolume,
    SetDetail,
    VolumeStatus,
)

logger = logging.getLogger(__name__)

# ─── Default Landmarks ────────────────────────────────────────────────────────

DEFAULT_LANDMARKS: dict[str, tuple[int, int, int]] = {
    "chest": (10, 16, 22),
    "back": (10, 18, 24),
    "shoulders": (8, 16, 22),
    "quads": (8, 16, 22),
    "hamstrings": (6, 12, 18),
    "glutes": (4, 12, 18),
    "biceps": (6, 14, 20),
    "triceps": (6, 12, 18),
    "calves": (6, 12, 16),
    "abs": (4, 10, 16),
    "traps": (4, 10, 16),
    "forearms": (4, 8, 14),
}


# ─── Pure Functions ───────────────────────────────────────────────────────────


def compute_effort(rpe: Optional[float]) -> float:
    """Return effort multiplier based on RPE tier.

    RPE is expected in the 1–10 range. Values outside that range are clamped.

    - RPE >= 8 or None → 1.0
    - 6 <= RPE < 8 → 0.75
    - RPE < 6 → 0.5
    """
    if rpe is None:
        return 1.0
    # Clamp to valid RPE range
    clamped = max(1.0, min(float(rpe), 10.0))
    if clamped >= 8:
        return 1.0
    if clamped >= 6:
        return 0.75
    return 0.5


def classify_status(effective_sets: float, mev: int, mav: int, mrv: int) -> VolumeStatus:
    """Classify volume status relative to landmarks.

    Returns:
        "below_mev"       — effective sets below Minimum Effective Volume
        "optimal"         — between MEV and MAV (inclusive)
        "approaching_mrv" — between MAV and MRV (inclusive)
        "above_mrv"       — exceeds Maximum Recoverable Volume
    """
    if effective_sets < mev:
        return "below_mev"
    if effective_sets <= mav:
        return "optimal"
    if effective_sets <= mrv:
        return "approaching_mrv"
    return "above_mrv"


def validate_week_start(week_start: date) -> date:
    """Validate that week_start is a Monday. Raises ValueError if not."""
    if week_start.weekday() != 0:
        raise ValueError("week_start must be a Monday date")
    return week_start


def _safe_float(value: object, default: float = 0.0) -> float:
    """Safely convert a value to float, returning *default* on failure."""
    try:
        result = float(value)  # type: ignore[arg-type]
        if not __import__("math").isfinite(result):
            return default
        return result
    except (TypeError, ValueError):
        return default


def _safe_int(value: object, default: int = 0) -> int:
    """Safely convert a value to int, returning *default* on failure."""
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


# ─── Service ──────────────────────────────────────────────────────────────────


class VolumeCalculatorService:
    """Computes weekly muscle group volume from training sessions."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_weekly_muscle_volume(
        self, user_id: uuid.UUID, week_start: date
    ) -> list[MuscleGroupVolume]:
        from src.modules.training.analytics_service import TrainingAnalyticsService
        from src.modules.training.landmark_store import LandmarkStore

        week_end = week_start + timedelta(days=6)
        svc = TrainingAnalyticsService(self.session)

        try:
            rows = await svc._fetch_sessions(user_id, week_start, week_end)
        except Exception:
            logger.exception("Failed to fetch training sessions for user %s", user_id)
            raise

        # Aggregate effective sets and frequency per muscle group
        volume: dict[str, float] = defaultdict(float)
        sessions_per_group: dict[str, set[date]] = defaultdict(set)

        for session_date, exercises in rows:
            for ex in exercises:
                mg = get_muscle_group(ex.get("exercise_name", ""))
                for s in ex.get("sets", []):
                    if s.get("set_type", "normal") == "warm-up":
                        continue
                    effort = compute_effort(s.get("rpe"))
                    volume[mg] += effort
                sessions_per_group[mg].add(session_date)

        # Get landmarks
        try:
            store = LandmarkStore(self.session)
            landmarks = await store.get_landmarks(user_id)
        except Exception:
            logger.exception("Failed to fetch landmarks for user %s", user_id)
            raise

        # Build response for all known muscle groups
        results: list[MuscleGroupVolume] = []
        for mg in DEFAULT_LANDMARKS:
            lm = landmarks[mg]
            eff = round(volume.get(mg, 0.0), 2)
            freq = len(sessions_per_group.get(mg, set()))
            status = classify_status(eff, lm.mev, lm.mav, lm.mrv)
            results.append(
                MuscleGroupVolume(
                    muscle_group=mg,
                    effective_sets=eff,
                    frequency=freq,
                    volume_status=status,
                    mev=lm.mev,
                    mav=lm.mav,
                    mrv=lm.mrv,
                )
            )

        return results

    async def get_muscle_group_detail(
        self, user_id: uuid.UUID, muscle_group: str, week_start: date
    ) -> MuscleGroupDetail:
        from src.modules.training.analytics_service import TrainingAnalyticsService
        from src.modules.training.landmark_store import LandmarkStore

        week_end = week_start + timedelta(days=6)
        svc = TrainingAnalyticsService(self.session)

        try:
            rows = await svc._fetch_sessions(user_id, week_start, week_end)
        except Exception:
            logger.exception(
                "Failed to fetch sessions for user %s, muscle group %s", user_id, muscle_group
            )
            raise

        # Collect per-exercise data for the target muscle group
        exercise_data: dict[str, list[SetDetail]] = defaultdict(list)
        session_dates: set[date] = set()

        for session_date, exercises in rows:
            for ex in exercises:
                ex_name = ex.get("exercise_name", "")
                mg = get_muscle_group(ex_name)
                if mg != muscle_group:
                    continue
                for s in ex.get("sets", []):
                    if s.get("set_type", "normal") == "warm-up":
                        continue
                    effort = compute_effort(s.get("rpe"))
                    exercise_data[ex_name].append(
                        SetDetail(
                            weight_kg=max(0.0, _safe_float(s.get("weight_kg", 0.0))),
                            reps=max(0, _safe_int(s.get("reps", 0))),
                            rpe=s.get("rpe"),
                            effort=effort,
                        )
                    )
                session_dates.add(session_date)

        # Build exercise details
        exercise_details: list[ExerciseVolumeDetail] = []
        total_effective = 0.0
        for ex_name, sets in exercise_data.items():
            eff = sum(s.effort for s in sets)
            total_effective += eff
            exercise_details.append(
                ExerciseVolumeDetail(
                    exercise_name=ex_name,
                    working_sets=len(sets),
                    effective_sets=round(eff, 2),
                    sets=sets,
                )
            )

        total_effective = round(total_effective, 2)

        # Get landmarks
        try:
            store = LandmarkStore(self.session)
            landmarks = await store.get_landmarks(user_id)
        except Exception:
            logger.exception("Failed to fetch landmarks for user %s", user_id)
            raise

        lm = landmarks.get(muscle_group)
        if lm is None:
            from src.shared.errors import NotFoundError

            raise NotFoundError(f"Muscle group '{muscle_group}' not found")

        status = classify_status(total_effective, lm.mev, lm.mav, lm.mrv)

        return MuscleGroupDetail(
            muscle_group=muscle_group,
            effective_sets=total_effective,
            frequency=len(session_dates),
            volume_status=status,
            mev=lm.mev,
            mav=lm.mav,
            mrv=lm.mrv,
            exercises=exercise_details,
        )
