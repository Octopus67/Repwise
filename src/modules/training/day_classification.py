"""Day classification service — determines training vs rest day with muscle groups."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.training.exercise_mapping import get_muscle_group
from src.modules.training.models import TrainingSession, WorkoutTemplate
from src.modules.training.schemas import DayClassificationResponse


def _extract_muscle_groups(exercises_jsonb: list[list[dict]] | None) -> list[str]:
    """Flatten exercises from multiple sessions/templates, extract and deduplicate muscle groups.

    Handles None, empty, and malformed inputs gracefully — never raises.
    """
    if not exercises_jsonb:
        return []
    groups: set[str] = set()
    for exercise_list in exercises_jsonb:
        if not isinstance(exercise_list, list):
            continue
        for exercise in exercise_list:
            if not isinstance(exercise, dict):
                continue
            name = exercise.get("exercise_name", "")
            if isinstance(name, str) and name.strip():
                groups.add(get_muscle_group(name))
    return sorted(groups)


async def classify_day(
    db: AsyncSession,
    user_id: uuid.UUID,
    target_date: date,
) -> DayClassificationResponse:
    """Classify a date as training day or rest day with muscle groups.

    Priority: logged sessions > scheduled templates > rest day.
    """
    # Step 1: Check for logged sessions on the target date
    session_query = (
        select(TrainingSession)
        .where(
            TrainingSession.user_id == user_id,
            TrainingSession.session_date == target_date,
            TrainingSession.deleted_at.is_(None),
        )
    )
    result = await db.execute(session_query)
    sessions = result.scalars().all()

    if sessions:
        exercise_lists = [s.exercises for s in sessions if s.exercises]
        muscle_groups = _extract_muscle_groups(exercise_lists)
        return DayClassificationResponse(
            is_training_day=True,
            classification="training",
            muscle_groups=muscle_groups,
            source="session",
        )

    # Step 2: Check for workout templates scheduled on this weekday
    template_query = (
        select(WorkoutTemplate)
        .where(
            WorkoutTemplate.user_id == user_id,
            WorkoutTemplate.deleted_at.is_(None),
        )
    )
    result = await db.execute(template_query)
    templates = result.scalars().all()

    target_weekday = target_date.weekday()  # 0=Monday, 6=Sunday

    matching_templates = []
    for template in templates:
        metadata = template.metadata_
        if not isinstance(metadata, dict):
            continue
        scheduled_days = metadata.get("scheduled_days")
        if not isinstance(scheduled_days, list):
            continue
        # Validate each entry is an int in range 0-6
        valid_days = [d for d in scheduled_days if isinstance(d, int) and 0 <= d <= 6]
        if target_weekday in valid_days:
            matching_templates.append(template)

    if matching_templates:
        exercise_lists = [t.exercises for t in matching_templates if t.exercises]
        muscle_groups = _extract_muscle_groups(exercise_lists)
        return DayClassificationResponse(
            is_training_day=True,
            classification="training",
            muscle_groups=muscle_groups,
            source="template",
        )

    # Step 3: Default — rest day
    return DayClassificationResponse(
        is_training_day=False,
        classification="rest",
        muscle_groups=[],
        source="none",
    )
