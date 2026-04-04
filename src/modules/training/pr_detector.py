"""PR (Personal Record) Detector for training sessions.

Compares each set in a new session against the user's historical bests
for that exercise at the same rep count. Flags sets that exceed the
previous best as personal records.

Requirements: 4.1, 4.2, 4.3, 4.4
"""

from __future__ import annotations

import uuid
from typing import Optional

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

        # Batch: single query for ALL historical sessions, then filter in Python
        bests_cache = await self._get_all_historical_bests(user_id, exercises)

        for exercise in exercises:
            historical = bests_cache.get(exercise.exercise_name, {})
            for s in exercise.sets:
                prev_best = historical.get(s.reps)
                if prev_best is None:
                    # First time hitting this exercise+rep combo — counts as a PR
                    prs.append(
                        PersonalRecord(
                            exercise_name=exercise.exercise_name,
                            reps=s.reps,
                            new_weight_kg=s.weight_kg,
                            previous_weight_kg=None,
                        )
                    )
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

    async def _get_all_historical_bests(
        self, user_id: uuid.UUID, exercises: list[ExerciseEntry]
    ) -> dict[str, dict[int, float]]:
        """Batch fetch historical bests for ALL exercises in a single query.

        Returns {exercise_name: {rep_count: best_weight_kg}}.
        Replaces N per-exercise queries with 1 query.
        """
        exercise_names = {ex.exercise_name for ex in exercises}
        lower_names = {name.lower() for name in exercise_names}

        # Single query: load sessions from the last 365 days (prevents memory issues for power users)
        from datetime import datetime, timedelta, timezone
        cutoff = datetime.utcnow() - timedelta(days=365)
        stmt = select(TrainingSession).where(
            TrainingSession.user_id == user_id,
            TrainingSession.deleted_at.is_(None),
            TrainingSession.created_at >= cutoff,
        )
        result = await self.session.execute(stmt)
        sessions = result.scalars().all()

        bests: dict[str, dict[int, float]] = {name: {} for name in exercise_names}

        for session in sessions:
            for exercise_data in session.exercises or []:
                ex_name = exercise_data.get("exercise_name", "")
                if ex_name.lower() not in lower_names:
                    continue
                # Match back to original casing
                matched_name = next(
                    (n for n in exercise_names if n.lower() == ex_name.lower()), None
                )
                if matched_name is None:
                    continue
                for set_data in exercise_data.get("sets", []):
                    reps = set_data.get("reps")
                    weight = set_data.get("weight_kg")
                    if reps is not None and weight is not None:
                        if reps not in bests[matched_name] or weight > bests[matched_name][reps]:
                            bests[matched_name][reps] = weight

        return bests

    async def get_historical_bests(
        self, user_id: uuid.UUID, exercise_name: str
    ) -> dict[int, float]:
        """Return {rep_count: best_weight_kg} for a given exercise.

        Uses PostgreSQL JSONB operators to query within the database
        instead of loading all sessions into memory.
        """
        from sqlalchemy import func
        
        # For SQLite (dev), fall back to loading sessions
        from src.config.settings import settings
        if "sqlite" in settings.DATABASE_URL:
            return await self._get_historical_bests_sqlite(user_id, exercise_name)
        
        # PostgreSQL: Use JSONB operators to extract sets directly
        # Query: SELECT reps, MAX(weight_kg) FROM training_sessions
        #        WHERE user_id = ? AND deleted_at IS NULL
        #        AND exercises @> '[{"exercise_name": "?"}]'
        #        GROUP BY reps
        
        # Use @> containment operator with parameterized JSON to avoid SQL injection.
        # Python-side loop below does case-insensitive exact matching.
        stmt = select(TrainingSession).where(
            TrainingSession.user_id == user_id,
            TrainingSession.deleted_at.is_(None),
            TrainingSession.exercises.op("@>")(
                func.cast(
                    func.jsonb_build_array(func.jsonb_build_object("exercise_name", exercise_name)),
                    type_=TrainingSession.exercises.type,
                )
            ),
        )
        
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
    
    async def _get_historical_bests_sqlite(
        self, user_id: uuid.UUID, exercise_name: str
    ) -> dict[int, float]:
        """SQLite fallback that loads all sessions (dev only)."""
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
