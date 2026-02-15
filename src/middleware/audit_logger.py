"""Audit logging middleware for state-changing operations.

Provides a FastAPI dependency that automatically logs create, update, and
delete operations to the audit_logs table.  Route handlers call
``record_audit`` after performing their mutation so the middleware captures
the user, action, entity type, entity ID, and change details.

The AuditLog model already lives in ``src/shared/audit.py`` — this module
only adds the request-scoped helper and a convenience dependency.
"""

from __future__ import annotations

import uuid
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any, Optional

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.shared.audit import AuditLog
from src.shared.types import AuditAction


# ---------------------------------------------------------------------------
# Request-scoped audit context
# ---------------------------------------------------------------------------

@dataclass
class _AuditEntry:
    """A single pending audit record collected during a request."""

    user_id: uuid.UUID
    action: AuditAction
    entity_type: str
    entity_id: uuid.UUID
    changes: dict[str, Any] = field(default_factory=dict)


# ContextVar holds the list of audit entries for the current request
_pending_audits: ContextVar[list[_AuditEntry]] = ContextVar(
    "_pending_audits", default=[]
)


def record_audit(
    *,
    user_id: uuid.UUID,
    action: AuditAction,
    entity_type: str,
    entity_id: uuid.UUID,
    changes: Optional[dict[str, Any]] = None,
) -> None:
    """Queue an audit log entry for the current request.

    Call this from route handlers or service methods after performing a
    state-changing operation.  The ``flush_audit_logs`` dependency will
    persist all queued entries before the response is sent.
    """
    entries = _pending_audits.get()
    entries.append(
        _AuditEntry(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            changes=changes or {},
        )
    )
    _pending_audits.set(entries)


async def flush_audit_logs(db: AsyncSession) -> list[AuditLog]:
    """Persist all queued audit entries and reset the context.

    Returns the list of created ``AuditLog`` rows (useful for testing).
    """
    entries = _pending_audits.get()
    if not entries:
        return []

    logs: list[AuditLog] = []
    for entry in entries:
        log = AuditLog(
            user_id=entry.user_id,
            action=entry.action.value,
            entity_type=entry.entity_type,
            entity_id=entry.entity_id,
            changes=entry.changes,
        )
        db.add(log)
        logs.append(log)

    await db.flush()
    _pending_audits.set([])
    return logs


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

class AuditLogger:
    """FastAPI dependency that provides audit logging within a request.

    Usage in a route::

        @router.post("/items")
        async def create_item(
            data: ItemCreate,
            user: User = Depends(get_current_user),
            audit: AuditLogger = Depends(get_audit_logger),
            db: AsyncSession = Depends(get_db),
        ):
            item = ...  # create item
            await audit.log(
                user_id=user.id,
                action=AuditAction.CREATE,
                entity_type="items",
                entity_id=item.id,
                changes={"new": data.model_dump()},
            )
            return item
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def log(
        self,
        *,
        user_id: uuid.UUID,
        action: AuditAction,
        entity_type: str,
        entity_id: uuid.UUID,
        changes: Optional[dict[str, Any]] = None,
    ) -> AuditLog:
        """Immediately persist an audit log entry."""
        entry = AuditLog(
            user_id=user_id,
            action=action.value,
            entity_type=entity_type,
            entity_id=entity_id,
            changes=changes or {},
        )
        self._db.add(entry)
        await self._db.flush()
        return entry


async def get_audit_logger(
    db: AsyncSession = Depends(get_db),
) -> AuditLogger:
    """FastAPI dependency that yields an ``AuditLogger`` bound to the request session."""
    return AuditLogger(db)
