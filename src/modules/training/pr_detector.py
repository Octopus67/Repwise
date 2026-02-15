"""PR (Personal Record) Detector for training sessions.

Compares each set in a new session against the user's historical bests
for that exercise at the same rep count. Flags sets that exceed the
previous best as personal records.

Requirements: 4.1, 4.2, 4.3, 4.4
"""

from __future__ import annotations

import uuid
from typing import Any, Optional

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.training.models import TrainingSession
from src.modules.training.schemas import ExerciseEntry


class PersonalRecord(BaseModel):
    """A detected personal record for an exercise at a given rep count."""

    exercise_name: str
    reps: int
    new_weight_kg: float
    previous_weight_kg: Optional[float] = None


class PRDetector:
    """Detects personal records when a training session is saved."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def detect_prs(
        self, user_id: uuid.UUID, exercises: list[ExerciseEntry]
    ) -> list[PersonalRecord]:
        """Compare each set against historical bests for that exercise+rep_count.

        Returns a list of PersonalRecord objects for sets that exceed the
        previous best. Sets with no history for that exercise+rep combo
        are skipped (Requirement 4.4).
        """
        prs: list[PersonalRecord] = []

        # Collect unique exercise names to batch historical lookups
        exercise_names = {ex.exercise_name for ex in exercises}
        bests_cache: dict[str, dict[int, float]] = {}
        for name in exercise_names:
            bests_cache[name] = await self.get_historical_bests(user_id, name)

        for exercise in exercises:
            historical = bests_cache.get(exercise.exercise_name, {})
            for s in exercise.sets:
                prev_best = historical.get(s.reps)
                if prev_best is None:
                    # No history for this exercise+rep combo — skip
                    continue
                if s.weight_kg > prev_best:
                    prs.append(
                        PersonalRecord(
                            exercise_name=exercise.exercise_name,
                            reps=s.reps,
                            new_weight_kg=s.weight_kg,
                            previous_weight_kg=prev_best,
                        )
                    )

        return prs

    async def get_historical_bests(
        self, user_id: uuid.UUID, exercise_name: str
    ) -> dict[int, float]:
        """Return {rep_count: best_weight_kg} for a given exercise.

        Queries all non-deleted sessions for the user and extracts the
        maximum weight_kg per rep count for the specified exercise.
        """
        stmt = select(TrainingSession).where(TrainingSession.user_id == user_id)
        stmt = TrainingSession.not_deleted(stmt)
        result = await self.session.execute(stmt)
        sessions = result.scalars().all()

        bests: dict[int, float] = {}
        lower_name = exercise_name.lower()

        for session in sessions:
            for exercise_data in session.exercises or []:
                if exercise_data.get("exercise_name", "").lower() == lower_name:
                    for set_data in exercise_data.get("sets", []):
                        reps = set_data.get("reps")
                        weight = set_data.get("weight_kg")
                        if reps is not None and weight is not None:
                            if reps not in bests or weight > bests[reps]:
                                bests[reps] = weight

        return bests
