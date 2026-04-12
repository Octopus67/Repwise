"""Workout template routes — pre-built & user-created templates."""

from __future__ import annotations
from typing import List

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.training.schemas import (
    UserWorkoutTemplateResponse,
    WorkoutTemplateCreate,
    WorkoutTemplateResponse,
    WorkoutTemplateUpdate,
)
from src.modules.training.template_service import TemplateService
from src.modules.training.models import WorkoutTemplate
from src.modules.training.templates import get_template_by_id, get_templates
from src.shared.errors import NotFoundError

router = APIRouter()


def _get_template_service(db: AsyncSession = Depends(get_db)) -> TemplateService:
    return TemplateService(db)


# ─── Pre-built Templates ─────────────────────────────────────────────────────


@router.get("/templates", response_model=List[WorkoutTemplateResponse])
async def list_templates() -> List[dict]:
    """Return all pre-built workout templates."""
    return get_templates()


@router.get("/templates/shared/{template_id}")
async def get_shared_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Public endpoint — return a template's exercise structure without user data."""
    stmt = select(WorkoutTemplate).where(WorkoutTemplate.id == template_id)
    stmt = WorkoutTemplate.not_deleted(stmt)
    result = await db.execute(stmt)
    template = result.scalar_one_or_none()
    if template is None:
        raise NotFoundError("Template not found")
    safe_exercises = []
    for ex in template.exercises or []:
        safe_ex = {"exercise_name": ex.get("exercise_name", ""), "sets": []}
        for s in ex.get("sets", []):
            safe_ex["sets"].append({"reps": s.get("reps"), "set_type": s.get("set_type", "normal")})
        safe_exercises.append(safe_ex)

    return {
        "id": str(template.id),
        "name": template.name,
        "description": template.description,
        "exercises": safe_exercises,
    }


@router.get("/templates/{template_id}", response_model=WorkoutTemplateResponse)
async def get_template(template_id: str) -> dict:
    """Return a single workout template by id."""
    template = get_template_by_id(template_id)
    if template is None:
        raise NotFoundError("Template not found")
    return template


# ─── User Templates (CRUD) ───────────────────────────────────────────────────


@router.post(
    "/user-templates",
    response_model=UserWorkoutTemplateResponse,
    status_code=201,
)
async def create_user_template(
    data: WorkoutTemplateCreate,
    user: User = Depends(get_current_user),
    service: TemplateService = Depends(_get_template_service),
) -> UserWorkoutTemplateResponse:
    """Create a new user workout template."""
    return await service.create_template(user_id=user.id, data=data)


@router.get(
    "/user-templates",
    response_model=List[UserWorkoutTemplateResponse],
)
async def list_user_templates(
    user: User = Depends(get_current_user),
    service: TemplateService = Depends(_get_template_service),
) -> list[UserWorkoutTemplateResponse]:
    """Return all user-created workout templates."""
    return await service.list_user_templates(user_id=user.id)


@router.put(
    "/user-templates/{template_id}",
    response_model=UserWorkoutTemplateResponse,
)
async def update_user_template(
    template_id: uuid.UUID,
    data: WorkoutTemplateUpdate,
    user: User = Depends(get_current_user),
    service: TemplateService = Depends(_get_template_service),
) -> UserWorkoutTemplateResponse:
    """Update a user workout template."""
    return await service.update_template(user_id=user.id, template_id=template_id, data=data)


@router.delete(
    "/user-templates/{template_id}",
    status_code=204,
    response_model=None,
)
async def delete_user_template(
    template_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: TemplateService = Depends(_get_template_service),
) -> None:
    """Soft-delete a user workout template."""
    await service.soft_delete_template(user_id=user.id, template_id=template_id)
