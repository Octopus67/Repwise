"""Business logic for the founder story module."""

from __future__ import annotations

import uuid
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.founder.models import FounderContent
from src.modules.founder.schemas import FounderContentUpdate
from src.shared.errors import NotFoundError
from src.shared.types import AuditAction


class FounderService:
    """Service layer for founder content operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_content(
        self,
        section_key: Optional[str] = None,
        locale: str = "en",
    ) -> list[FounderContent]:
        """Return founder content, optionally filtered by section and locale.

        Requirement 13.1: Return transformation timeline, narrative, metrics,
        and philosophy content.
        """
        stmt = select(FounderContent)
        if section_key is not None:
            stmt = stmt.where(FounderContent.section_key == section_key)
        stmt = stmt.where(FounderContent.locale == locale)
        stmt = stmt.order_by(FounderContent.section_key)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update_content(
        self,
        data: FounderContentUpdate,
        admin_user_id: uuid.UUID,
    ) -> FounderContent:
        """Create or update founder content for a section/locale pair.

        Requirement 13.2: Admin updates are persisted and immediately available.
        Requirement 21.3: Admin manages founder story content.
        """
        stmt = select(FounderContent).where(
            FounderContent.section_key == data.section_key,
            FounderContent.locale == data.locale,
        )
        result = await self.session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing is not None:
            old_content = existing.content
            existing.content = data.content
            existing.version += 1
            await existing.write_audit(
                self.session,
                user_id=admin_user_id,
                action=AuditAction.UPDATE,
                entity_id=existing.id,
                changes={"old": old_content, "new": data.content},
            )
            await self.session.flush()
            return existing

        # Create new entry
        entry = FounderContent(
            section_key=data.section_key,
            locale=data.locale,
            content=data.content,
            version=1,
        )
        self.session.add(entry)
        await self.session.flush()

        await entry.write_audit(
            self.session,
            user_id=admin_user_id,
            action=AuditAction.CREATE,
            entity_id=entry.id,
            changes={"new": data.content},
        )
        return entry
