"""Import service — preview and execute CSV workout imports."""

from __future__ import annotations

import hashlib
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only

from src.modules.import_data.exercise_mapper import map_exercises
from src.modules.import_data.parser import ImportedWorkout, parse_csv
from src.modules.import_data.schemas import (
    ExerciseMapping,
    ImportPreviewResponse,
    ImportResultResponse,
)
from src.modules.training.models import CustomExercise, TrainingSession
from src.modules.training.schemas import ExerciseEntry, SetEntry

logger = logging.getLogger(__name__)

BATCH_SIZE = 50


def _workout_hash(user_id: uuid.UUID, workout: ImportedWorkout) -> str:
    """Deterministic hash for duplicate detection: user + date + exercises + set count."""
    ex_names = sorted(e.name for e in workout.exercises)
    set_count = sum(len(e.sets) for e in workout.exercises)
    raw = f"{user_id}|{workout.date.date()}|{'|'.join(ex_names)}|{set_count}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


class ImportService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def preview_import(
        self, content: str, weight_unit: str = "kg", user_id: uuid.UUID | None = None
    ) -> ImportPreviewResponse:
        """Parse CSV and return preview without saving anything."""
        workouts = parse_csv(content, weight_unit=weight_unit)
        if not workouts:
            return ImportPreviewResponse(
                session_count=0,
                date_range=("", ""),
                exercise_mappings=[],
                unmapped_count=0,
            )

        all_names = list({e.name for w in workouts for e in w.exercises})

        db_exercises: list[dict] = []
        if user_id:
            stmt = select(CustomExercise).where(
                CustomExercise.user_id == user_id,
                CustomExercise.deleted_at.is_(None),
            )
            result = await self.session.execute(stmt)
            db_exercises = [{"id": str(e.id), "name": e.name} for e in result.scalars().all()]

        if db_exercises:
            raw_mappings = map_exercises(all_names, db_exercises)
            mappings = [
                ExerciseMapping(
                    imported_name=n,
                    matched=raw_mappings[n].get("matched"),
                    create_as_custom=not raw_mappings[n].get("matched"),
                )
                for n in all_names
            ]
        else:
            mappings = [ExerciseMapping(imported_name=n, create_as_custom=True) for n in all_names]

        dates = sorted(w.date for w in workouts)
        return ImportPreviewResponse(
            session_count=len(workouts),
            date_range=(dates[0].strftime("%Y-%m-%d"), dates[-1].strftime("%Y-%m-%d")),
            exercise_mappings=mappings,
            unmapped_count=sum(1 for m in mappings if m.create_as_custom),
        )

    async def execute_import(
        self,
        user_id: uuid.UUID,
        content: str,
        weight_unit: str = "kg",
    ) -> ImportResultResponse:
        """Parse CSV, map exercises, create sessions in batches."""
        workouts = parse_csv(content, weight_unit=weight_unit)
        if not workouts:
            return ImportResultResponse(sessions_imported=0, exercises_created=0, prs_detected=0)

        # Load all user custom exercises once (no N+1)
        stmt = select(CustomExercise).where(
            CustomExercise.user_id == user_id,
            CustomExercise.deleted_at.is_(None),
        )
        result = await self.session.execute(stmt)
        db_exercises = [{"id": str(e.id), "name": e.name} for e in result.scalars().all()]

        # Map imported names to DB exercises
        all_names = list({e.name for w in workouts for e in w.exercises})
        mappings = map_exercises(all_names, db_exercises)

        # Create custom exercises for unmapped names
        exercises_created = 0
        name_to_exercise: dict[str, str] = {}  # imported_name → exercise_name to use
        for name, info in mappings.items():
            if info.get("matched"):
                name_to_exercise[name] = info["matched"]
            else:
                # Create as custom exercise
                custom = CustomExercise(
                    user_id=user_id,
                    name=name,
                    muscle_group="full_body",
                    secondary_muscles=[],
                    equipment="bodyweight",
                    category="compound",
                )
                self.session.add(custom)
                name_to_exercise[name] = name
                exercises_created += 1

        if exercises_created:
            await self.session.flush()

        # Duplicate detection: load existing session hashes
        existing_hashes = set()
        existing_stmt = (
            select(TrainingSession)
            .where(
                TrainingSession.user_id == user_id,
                TrainingSession.deleted_at.is_(None),
            )
            .options(load_only(TrainingSession.session_date, TrainingSession.exercises))
        )
        existing_result = await self.session.execute(existing_stmt)
        for s in existing_result.scalars().all():
            # Reconstruct hash from existing sessions
            ex_names = sorted(e.get("exercise_name", "") for e in (s.exercises or []))
            set_count = sum(len(e.get("sets", [])) for e in (s.exercises or []))
            raw = f"{user_id}|{s.session_date}|{'|'.join(ex_names)}|{set_count}"
            existing_hashes.add(hashlib.sha256(raw.encode()).hexdigest()[:16])

        # Create sessions in batches
        sessions_imported = 0
        for i in range(0, len(workouts), BATCH_SIZE):
            batch = workouts[i : i + BATCH_SIZE]
            for workout in batch:
                h = _workout_hash(user_id, workout)
                if h in existing_hashes:
                    continue  # Skip duplicate

                exercises = []
                for ex in workout.exercises:
                    mapped_name = name_to_exercise.get(ex.name, ex.name)
                    sets = [
                        SetEntry(
                            reps=s.reps,
                            weight_kg=s.weight_kg,
                            rpe=s.rpe,
                            set_type=s.set_type
                            if s.set_type in {"normal", "warm-up", "drop-set", "amrap"}
                            else "normal",
                        )
                        for s in ex.sets
                    ]
                    if sets:
                        exercises.append(ExerciseEntry(exercise_name=mapped_name, sets=sets))

                if not exercises:
                    continue

                session = TrainingSession(
                    user_id=user_id,
                    session_date=workout.date.date(),
                    exercises=[e.model_dump() for e in exercises],
                    metadata_={"source": "csv_import", "original_name": workout.name},
                )
                self.session.add(session)
                sessions_imported += 1

            await self.session.flush()

        return ImportResultResponse(
            sessions_imported=sessions_imported,
            exercises_created=exercises_created,
            prs_detected=0,
        )
