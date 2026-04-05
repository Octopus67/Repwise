"""Template service — CRUD for user-created workout templates."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.training.models import WorkoutTemplate
from src.modules.training.schemas import (
    UserWorkoutTemplateResponse,
    WorkoutTemplateCreate,
    WorkoutTemplateUpdate,
)
from src.shared.errors import NotFoundError
from src.shared.types import AuditAction


class TemplateService:
    """Handles user workout template creation, retrieval, update, and soft-delete."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_template(
        self, user_id: uuid.UUID, data: WorkoutTemplateCreate
    ) -> UserWorkoutTemplateResponse:
        """Persist a new user workout template."""
        template = WorkoutTemplate(
            user_id=user_id,
            name=data.name,
            description=data.description,
            exercises=[ex.model_dump() for ex in data.exercises],
            metadata_=data.metadata,
            sort_order=0,
        )
        self.session.add(template)
        await self.session.flush()
        return UserWorkoutTemplateResponse.from_orm_model(template)

    async def list_user_templates(
        self, user_id: uuid.UUID
    ) -> list[UserWorkoutTemplateResponse]:
        """Return all non-deleted templates for a user, ordered by sort_order ASC, created_at DESC."""
        stmt = select(WorkoutTemplate).where(WorkoutTemplate.user_id == user_id)
        stmt = WorkoutTemplate.not_deleted(stmt)
        stmt = stmt.order_by(
            WorkoutTemplate.sort_order.asc(),
            WorkoutTemplate.created_at.desc(),
        )
        result = await self.session.execute(stmt)
        rows = result.scalars().all()
        return [UserWorkoutTemplateResponse.from_orm_model(r) for r in rows]

    async def update_template(
        self,
        user_id: uuid.UUID,
        template_id: uuid.UUID,
        data: WorkoutTemplateUpdate,
    ) -> UserWorkoutTemplateResponse:
        """Update a user workout template with audit trail."""
        template = await self._get_or_404(user_id, template_id)

        changes: dict[str, dict] = {}
        if data.name is not None and data.name != template.name:
            changes["name"] = {"old": template.name, "new": data.name}
            template.name = data.name

        if data.description is not None and data.description != template.description:
            changes["description"] = {"old": template.description, "new": data.description}
            template.description = data.description

        if data.exercises is not None:
            changes["exercises"] = {"old": template.exercises}
            template.exercises = [ex.model_dump() for ex in data.exercises]
            changes["exercises"]["new"] = template.exercises

        if data.metadata is not None:
            changes["metadata"] = {"old": template.metadata_}
            template.metadata_ = data.metadata
            changes["metadata"]["new"] = template.metadata_

        if changes:
            await WorkoutTemplate.write_audit(
                self.session,
                user_id=user_id,
                action=AuditAction.UPDATE,
                entity_id=template_id,
                changes=changes,
            )
            template.updated_at = datetime.now(timezone.utc)

        await self.session.flush()
        return UserWorkoutTemplateResponse.from_orm_model(template)

    async def soft_delete_template(
        self, user_id: uuid.UUID, template_id: uuid.UUID
    ) -> None:
        """Soft-delete a user workout template."""
        template = await self._get_or_404(user_id, template_id)
        template.deleted_at = datetime.now(timezone.utc)

        await WorkoutTemplate.write_audit(
            self.session,
            user_id=user_id,
            action=AuditAction.DELETE,
            entity_id=template_id,
        )
        await self.session.flush()

    async def _get_or_404(
        self, user_id: uuid.UUID, template_id: uuid.UUID
    ) -> WorkoutTemplate:
        """Fetch a non-deleted template or raise NotFoundError."""
        stmt = select(WorkoutTemplate).where(
            WorkoutTemplate.id == template_id,
            WorkoutTemplate.user_id == user_id,
        )
        stmt = WorkoutTemplate.not_deleted(stmt)
        result = await self.session.execute(stmt)
        template = result.scalar_one_or_none()
        if template is None:
            raise NotFoundError("Template not found")
        return template
