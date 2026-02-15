"""Sync Engine Service — async service layer for daily adjusted targets."""

from __future__ import annotations
from typing import Optional

import logging
import uuid
from datetime import date, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.adaptive.models import AdaptiveSnapshot, DailyTargetOverride
from src.modules.adaptive.schemas import (
    DailyTargetResponse,
    MacroTargets,
    OverrideCreate,
    OverrideResponse,
)
from src.modules.adaptive.sync_engine import (
    DailyTargetInput,
    SessionExercise,
    compute_daily_targets,
)
from src.modules.training.exercise_mapping import get_muscle_group, is_compound
from src.shared.errors import ApiError
from src.shared.types import TrainingPhase

try:
    from src.modules.training.models import TrainingSession
except ImportError:
    logging.getLogger(__name__).error("Failed to import TrainingSession — circular import")
    TrainingSession = None  # type: ignore[assignment,misc]

logger = logging.getLogger(__name__)


class SyncEngineService:
    """Orchestrates daily target computation with DB I/O."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_daily_targets(
        self,
        user_id: uuid.UUID,
        target_date: date,
        training_phase: TrainingPhase = TrainingPhase.NONE,
    ) -> DailyTargetResponse:
        # Fetch latest adaptive snapshot
        snap_stmt = (
            select(AdaptiveSnapshot)
            .where(AdaptiveSnapshot.user_id == user_id)
            .order_by(AdaptiveSnapshot.created_at.desc())
            .limit(1)
        )
        snap = (await self.session.execute(snap_stmt)).scalar_one_or_none()
        if snap is None:
            raise ApiError(
                status=400,
                code="NO_SNAPSHOT",
                message="No adaptive snapshot found. Generate a snapshot first.",
            )

        # Classify day
        is_training, exercises_json, reason = await self._classify_day(user_id, target_date)

        # Build session exercises
        session_exercises = self._build_session_exercises(exercises_json)

        # Rolling average volume
        rolling_avg = await self._get_rolling_avg_volume(user_id, target_date)

        # Session volume
        session_vol = sum(ex.total_volume for ex in session_exercises)

        # Build input
        inp = DailyTargetInput(
            baseline_calories=snap.target_calories,
            baseline_protein_g=snap.target_protein_g,
            baseline_carbs_g=snap.target_carbs_g,
            baseline_fat_g=snap.target_fat_g,
            is_training_day=is_training,
            session_exercises=session_exercises,
            session_volume=session_vol,
            rolling_avg_volume=rolling_avg,
            training_phase=training_phase,
        )

        output = compute_daily_targets(inp)

        # Check for override
        override_row = await self._get_override(user_id, target_date)

        baseline = MacroTargets(
            calories=snap.target_calories,
            protein_g=snap.target_protein_g,
            carbs_g=snap.target_carbs_g,
            fat_g=snap.target_fat_g,
        )
        adjusted = MacroTargets(
            calories=output.adjusted_calories,
            protein_g=output.adjusted_protein_g,
            carbs_g=output.adjusted_carbs_g,
            fat_g=output.adjusted_fat_g,
        )

        override_macros = None
        if override_row:
            override_macros = MacroTargets(
                calories=override_row.calories,
                protein_g=override_row.protein_g,
                carbs_g=override_row.carbs_g,
                fat_g=override_row.fat_g,
            )

        effective = override_macros if override_macros else adjusted

        return DailyTargetResponse(
            date=target_date,
            day_classification=output.day_classification,
            classification_reason=reason,
            baseline=baseline,
            adjusted=adjusted,
            override=override_macros,
            effective=effective,
            muscle_group_demand=output.muscle_group_demand,
            volume_multiplier=output.volume_multiplier,
            training_phase=training_phase.value,
            calorie_delta=output.calorie_delta,
            explanation=output.explanation,
        )

    async def set_override(
        self, user_id: uuid.UUID, data: OverrideCreate,
    ) -> OverrideResponse:
        """Upsert a daily target override."""
        existing = await self._get_override(user_id, data.date)
        if existing:
            existing.calories = data.calories
            existing.protein_g = data.protein_g
            existing.carbs_g = data.carbs_g
            existing.fat_g = data.fat_g
            await self.session.flush()
            return OverrideResponse.model_validate(existing)

        row = DailyTargetOverride(
            user_id=user_id,
            target_date=data.date,
            calories=data.calories,
            protein_g=data.protein_g,
            carbs_g=data.carbs_g,
            fat_g=data.fat_g,
        )
        self.session.add(row)
        await self.session.flush()
        return OverrideResponse.model_validate(row)

    async def remove_override(self, user_id: uuid.UUID, target_date: date) -> None:
        """Delete a daily target override."""
        stmt = delete(DailyTargetOverride).where(
            DailyTargetOverride.user_id == user_id,
            DailyTargetOverride.target_date == target_date,
        )
        await self.session.execute(stmt)
        await self.session.flush()

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _classify_day(
        self, user_id: uuid.UUID, target_date: date,
    ) -> tuple[bool, list[dict], str]:
        """Check training sessions for the date. Returns (is_training, exercises_json, reason)."""
        try:
            stmt = (
                select(TrainingSession)
                .where(
                    TrainingSession.user_id == user_id,
                    TrainingSession.session_date == target_date,
                )
                .limit(1)
            )
            result = await self.session.execute(stmt)
            session = result.scalar_one_or_none()
            if session:
                exercises = session.exercises if isinstance(session.exercises, list) else []
                return True, exercises, "Session logged"
        except Exception:
            logger.exception("Failed to classify training day for user %s on %s", user_id, target_date)

        return False, [], "No session"

    async def _get_rolling_avg_volume(
        self, user_id: uuid.UUID, end_date: date, weeks: int = 4,
    ) -> float:
        """Compute average session volume over the last N weeks."""
        start_date = end_date - timedelta(weeks=weeks)
        try:
            stmt = select(TrainingSession).where(
                TrainingSession.user_id == user_id,
                TrainingSession.session_date >= start_date,
                TrainingSession.session_date < end_date,
            )
            result = await self.session.execute(stmt)
            sessions = result.scalars().all()

            if not sessions:
                return 0.0

            total_vol = 0.0
            count = 0
            for s in sessions:
                exercises = s.exercises if isinstance(s.exercises, list) else []
                for ex in exercises:
                    sets = ex.get("sets", [])
                    if not isinstance(sets, list):
                        sets = []
                    for st in sets:
                        total_vol += st.get("reps", 0) * st.get("weight_kg", 0)
                count += 1

            return total_vol / count if count > 0 else 0.0
        except Exception:
            logger.exception("Failed to compute rolling avg volume for user %s", user_id)
            return 0.0

    async def _get_override(
        self, user_id: uuid.UUID, target_date: date,
    ) -> Optional[DailyTargetOverride]:
        stmt = select(DailyTargetOverride).where(
            DailyTargetOverride.user_id == user_id,
            DailyTargetOverride.target_date == target_date,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    def _build_session_exercises(self, exercises_json: list[dict]) -> list[SessionExercise]:
        """Convert raw JSON exercises to SessionExercise list."""
        result: list[SessionExercise] = []
        for ex in exercises_json:
            name = ex.get("exercise_name", ex.get("name", ""))
            sets = ex.get("sets", [])
            if not isinstance(sets, list):
                sets = []
            total_sets = len(sets)
            total_reps = sum(s.get("reps", 0) for s in sets)
            total_volume = sum(s.get("reps", 0) * s.get("weight_kg", 0) for s in sets)
            result.append(SessionExercise(
                exercise_name=name,
                muscle_group=get_muscle_group(name),
                is_compound=is_compound(name),
                total_sets=total_sets,
                total_reps=total_reps,
                total_volume=total_volume,
            ))
        return result
