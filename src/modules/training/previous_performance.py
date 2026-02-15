"""Previous Performance Resolver — retrieves most recent session data for an exercise.

Requirements: 6.1, 6.4
"""

from __future__ import annotations
from typing import Optional

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.training.analytics_schemas import PreviousPerformance
from src.modules.training.models import TrainingSession


class PreviousPerformanceResolver:
    """Fetches the most recent session data for a given exercise."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_previous_performance(
        self, user_id: uuid.UUID, exercise_name: str
    ) -> Optional[PreviousPerformance]:
        """Return the last set from the most recent session containing *exercise_name*.

        Queries training_sessions for the user, ordered by session_date DESC.
        Iterates through sessions to find one containing the exercise, then
        extracts the last set from that exercise entry.

        Returns None if no previous session exists for this exercise.
        """
        stmt = (
            select(TrainingSession)
            .where(TrainingSession.user_id == user_id)
            .order_by(TrainingSession.session_date.desc())
        )
        stmt = TrainingSession.not_deleted(stmt)

        result = await self.session.execute(stmt)
        sessions = result.scalars().all()

        lower_name = exercise_name.lower().strip()

        for session in sessions:
            for exercise_data in session.exercises or []:
                if exercise_data.get("exercise_name", "").lower().strip() == lower_name:
                    sets = exercise_data.get("sets", [])
                    if not sets:
                        continue
                    last_set = sets[-1]
                    weight = last_set.get("weight_kg")
                    reps = last_set.get("reps")
                    if weight is not None and reps is not None:
                        return PreviousPerformance(
                            exercise_name=exercise_name,
                            session_date=session.session_date,
                            last_set_weight_kg=weight,
                            last_set_reps=reps,
                        )

        return None
from src.modules.training.schemas import (
    PreviousPerformanceResult,
    PreviousPerformanceSetData,
)


class BatchPreviousPerformanceResolver:
    """Fetches the most recent session data for multiple exercises in a single query.

    Requirements: 3.1, 3.5
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_batch_previous_performance(
        self, user_id: uuid.UUID, exercise_names: list[str]
    ) -> dict[str, Optional[PreviousPerformanceResult]]:
        """Return previous performance for each requested exercise.

        Queries the user's sessions once (ordered by date DESC, LIMIT 50),
        iterates to find the most recent occurrence of each requested exercise,
        and returns ALL sets for each exercise found.
        """
        # Normalise requested names for case-insensitive matching
        wanted: dict[str, str] = {name.lower().strip(): name for name in exercise_names}
        found: dict[str, PreviousPerformanceResult] = {}

        stmt = (
            select(TrainingSession)
            .where(TrainingSession.user_id == user_id)
            .order_by(TrainingSession.session_date.desc())
            .limit(50)
        )
        stmt = TrainingSession.not_deleted(stmt)

        result = await self.session.execute(stmt)
        sessions = result.scalars().all()

        for session in sessions:
            # Stop early if we've found all requested exercises
            if len(found) == len(wanted):
                break

            for exercise_data in session.exercises or []:
                ex_name = exercise_data.get("exercise_name", "").lower().strip()
                if ex_name in wanted and ex_name not in found:
                    raw_sets = exercise_data.get("sets", [])
                    if not raw_sets:
                        continue
                    sets = [
                        PreviousPerformanceSetData(
                            weight_kg=s.get("weight_kg", 0),
                            reps=s.get("reps", 0),
                            rpe=s.get("rpe"),
                        )
                        for s in raw_sets
                    ]
                    found[ex_name] = PreviousPerformanceResult(
                        exercise_name=wanted[ex_name],
                        session_date=session.session_date,
                        sets=sets,
                    )

        # Build final results dict using original exercise names
        results: dict[str, Optional[PreviousPerformanceResult]] = {}
        for name in exercise_names:
            key = name.lower().strip()
            results[name] = found.get(key)

        return results

