"""Custom exercise service — CRUD for user-created exercises."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.training.models import CustomExercise
from src.shared.errors import NotFoundError


# ---------------------------------------------------------------------------
# Pure validation helpers (testable without DB)
# ---------------------------------------------------------------------------

VALID_MUSCLE_GROUPS = frozenset([
    "chest", "back", "shoulders", "biceps", "triceps",
    "quads", "hamstrings", "glutes", "calves", "abs",
    "traps", "forearms", "full_body",
])

VALID_EQUIPMENT = frozenset([
    "barbell", "dumbbell", "cable", "machine",
    "bodyweight", "band", "kettlebell", "smith_machine",
])

VALID_CATEGORIES = frozenset(["compound", "isolation"])


def validate_custom_exercise_fields(
    name: str,
    muscle_group: str,
    equipment: str,
    category: str = "compound",
    secondary_muscles: Optional[list[str]] = None,
) -> list[str]:
    """Return a list of validation error messages (empty if valid)."""
    errors: list[str] = []
    if not name or not name.strip():
        errors.append("Name is required.")
    if len(name) > 200:
        errors.append("Name must be 200 characters or fewer.")
    if muscle_group.lower() not in VALID_MUSCLE_GROUPS:
        errors.append(f"Invalid muscle group: {muscle_group}")
    if equipment.lower() not in VALID_EQUIPMENT:
        errors.append(f"Invalid equipment: {equipment}")
    if category.lower() not in VALID_CATEGORIES:
        errors.append(f"Invalid category: {category}")
    if secondary_muscles:
        for mg in secondary_muscles:
            if mg.lower() not in VALID_MUSCLE_GROUPS:
                errors.append(f"Invalid secondary muscle group: {mg}")
    return errors


def format_custom_exercise_as_dict(exercise: CustomExercise) -> dict:
    """Format a CustomExercise ORM instance as a dict matching the system exercise shape."""
    return {
        "id": f"custom-{exercise.id}",
        "name": exercise.name,
        "muscle_group": exercise.muscle_group,
        "secondary_muscles": exercise.secondary_muscles or [],
        "equipment": exercise.equipment,
        "category": exercise.category,
        "image_url": None,
        "animation_url": None,
        "description": exercise.notes,
        "instructions": None,
        "tips": None,
        "is_custom": True,
    }


# ---------------------------------------------------------------------------
# Async service
# ---------------------------------------------------------------------------


class CustomExerciseService:
    """Handles custom exercise creation, retrieval, update, and soft-delete."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_custom_exercise(
        self,
        user_id: uuid.UUID,
        name: str,
        muscle_group: str,
        equipment: str,
        category: str = "compound",
        secondary_muscles: Optional[list[str]] = None,
        notes: Optional[str] = None,
    ) -> CustomExercise:
        """Persist a new custom exercise."""
        exercise = CustomExercise(
            user_id=user_id,
            name=name.strip(),
            muscle_group=muscle_group.lower(),
            secondary_muscles=secondary_muscles or [],
            equipment=equipment.lower(),
            category=category.lower(),
            notes=notes,
        )
        self.session.add(exercise)
        await self.session.flush()
        return exercise

    async def list_user_custom_exercises(
        self, user_id: uuid.UUID
    ) -> list[CustomExercise]:
        """Return all non-deleted custom exercises for a user."""
        stmt = select(CustomExercise).where(CustomExercise.user_id == user_id)
        stmt = CustomExercise.not_deleted(stmt)
        stmt = stmt.order_by(CustomExercise.created_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_user_custom_exercises_as_dicts(
        self, user_id: uuid.UUID
    ) -> list[dict]:
        """Return custom exercises formatted to match the system exercise dict shape."""
        exercises = await self.list_user_custom_exercises(user_id)
        return [format_custom_exercise_as_dict(ex) for ex in exercises]

    async def update_custom_exercise(
        self,
        user_id: uuid.UUID,
        exercise_id: uuid.UUID,
        name: Optional[str] = None,
        muscle_group: Optional[str] = None,
        equipment: Optional[str] = None,
        category: Optional[str] = None,
        secondary_muscles: Optional[list[str]] = None,
        notes: Optional[str] = None,
    ) -> CustomExercise:
        """Update a custom exercise."""
        exercise = await self._get_or_404(user_id, exercise_id)

        if name is not None:
            exercise.name = name.strip()
        if muscle_group is not None:
            exercise.muscle_group = muscle_group.lower()
        if equipment is not None:
            exercise.equipment = equipment.lower()
        if category is not None:
            exercise.category = category.lower()
        if secondary_muscles is not None:
            exercise.secondary_muscles = secondary_muscles
        if notes is not None:
            exercise.notes = notes

        exercise.updated_at = datetime.now(timezone.utc)
        await self.session.flush()
        return exercise

    async def delete_custom_exercise(
        self, user_id: uuid.UUID, exercise_id: uuid.UUID
    ) -> None:
        """Soft-delete a custom exercise."""
        exercise = await self._get_or_404(user_id, exercise_id)
        exercise.deleted_at = datetime.now(timezone.utc)
        await self.session.flush()

    async def _get_or_404(
        self, user_id: uuid.UUID, exercise_id: uuid.UUID
    ) -> CustomExercise:
        """Fetch a non-deleted custom exercise or raise NotFoundError."""
        stmt = select(CustomExercise).where(
            CustomExercise.id == exercise_id,
            CustomExercise.user_id == user_id,
        )
        stmt = CustomExercise.not_deleted(stmt)
        result = await self.session.execute(stmt)
        exercise = result.scalar_one_or_none()
        if exercise is None:
            raise NotFoundError("Custom exercise not found")
        return exercise
