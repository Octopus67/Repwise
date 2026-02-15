"""SQLAlchemy models for the coaching system.

Tables: CoachProfiles, CoachingRequests, CoachingSessions.
Supports Requirement 12.1–12.7.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.shared.audit import AuditLogMixin
from src.shared.base_model import Base


class CoachProfile(Base, AuditLogMixin):
    """Coach profile entity (Requirement 12.6).

    Stored separately to support future multi-coach expansion.
    """

    __tablename__ = "coach_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), unique=True, index=True,
    )
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    specializations: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, server_default=text("'[]'::jsonb"),
    )
    is_active: Mapped[bool] = mapped_column(default=True)


class CoachingRequest(Base, AuditLogMixin):
    """A coaching request submitted by a premium user (Requirement 12.1).

    Status transitions: pending → approved | rejected | cancelled.
    """

    __tablename__ = "coaching_requests"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), index=True,
    )
    status: Mapped[str] = mapped_column(String(20), default="pending")
    goals: Mapped[str] = mapped_column(Text)
    progress_data: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, server_default=text("'{}'::jsonb"),
    )
    document_urls: Mapped[Optional[list[str]]] = mapped_column(
        JSONB, nullable=True, server_default=text("'[]'::jsonb"),
    )

    # Relationship to session (one-to-one)
    session: Mapped[Optional[CoachingSession]] = relationship(
        "CoachingSession", back_populates="request", uselist=False,
    )

    __table_args__ = (
        Index("ix_coaching_requests_user_status", "user_id", "status"),
    )


class CoachingSession(Base, AuditLogMixin):
    """A coaching session created when a request is approved (Requirement 12.2, 12.3).

    Status transitions: scheduled → in_progress → completed, scheduled → cancelled.
    """

    __tablename__ = "coaching_sessions"

    request_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("coaching_requests.id"), unique=True,
    )
    coach_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("coach_profiles.id"), index=True,
    )
    status: Mapped[str] = mapped_column(String(20), default="scheduled")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    document_urls: Mapped[Optional[list[str]]] = mapped_column(
        JSONB, nullable=True, server_default=text("'[]'::jsonb"),
    )
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    request: Mapped[CoachingRequest] = relationship(
        "CoachingRequest", back_populates="session",
    )
