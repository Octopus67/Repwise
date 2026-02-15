"""Audit log mixin and helpers for state-changing operations.

Provides an ``AuditLogMixin`` that makes it easy to create audit log entries
whenever an entity is created, updated, or deleted.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.base_model import Base
from src.shared.types import AuditAction


class AuditLog(Base):
    """Persisted audit log entry for every state-changing operation.

    Fields
    ------
    user_id : UUID of the user who performed the action.
    action  : One of ``create``, ``update``, ``delete``.
    entity_type : The table / model name of the affected entity.
    entity_id : Primary key of the affected entity.
    changes : JSONB blob capturing the delta (e.g. old/new values).
    created_at : Inherited from Base — timestamp of the event.
    """

    __tablename__ = "audit_logs"

    user_id: Mapped[uuid.UUID] = mapped_column(index=True)
    action: Mapped[str] = mapped_column()
    entity_type: Mapped[str] = mapped_column()
    entity_id: Mapped[uuid.UUID] = mapped_column()
    changes: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        server_default=text("'{}'::jsonb"),
    )


class AuditLogMixin:
    """Mixin providing a helper to create audit log entries.

    Any model that includes this mixin gains a convenience class method
    ``write_audit`` that persists an ``AuditLog`` row.
    """

    @classmethod
    async def write_audit(
        cls,
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
        action: AuditAction,
        entity_id: uuid.UUID,
        changes: Optional[dict[str, Any]] = None,
    ) -> AuditLog:
        """Create and flush an audit log entry.

        Parameters
        ----------
        session : The current async database session.
        user_id : Who performed the action.
        action : ``create``, ``update``, or ``delete``.
        entity_id : PK of the affected row.
        changes : Optional dict describing what changed.

        Returns
        -------
        The newly created ``AuditLog`` instance.
        """
        entry = AuditLog(
            user_id=user_id,
            action=action.value,
            entity_type=cls.__tablename__,  # type: ignore[attr-defined]
            entity_id=entity_id,
            changes=changes or {},
        )
        session.add(entry)
        await session.flush()
        return entry
