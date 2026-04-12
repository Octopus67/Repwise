"""Achievement module SQLAlchemy models."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.audit import AuditLogMixin
from src.shared.base_model import Base
from src.shared.soft_delete import SoftDeleteMixin


class UserAchievement(SoftDeleteMixin, AuditLogMixin, Base):
    """Records an unlocked achievement for a user.

    The ``achievement_id`` references a static :pydata:`AchievementDef.id`
    from :mod:`src.modules.achievements.definitions`.
    """

    __tablename__ = "user_achievements"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    achievement_id: Mapped[str] = mapped_column(String(100), nullable=False)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    trigger_data: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
        server_default=text("NULL"),
    )

    __table_args__ = (
        UniqueConstraint("user_id", "achievement_id", name="uq_user_achievement"),
        Index("ix_user_achievements_user_id", "user_id"),
        Index(
            "ix_user_achievements_not_deleted", "id", postgresql_where=text("deleted_at IS NULL")
        ),
    )


class AchievementProgress(Base):
    """Tracks incremental progress toward achievements.

    One row per ``(user_id, progress_type)`` combination.  Progress types:
    ``"lifetime_volume"``, ``"streak"``, ``"nutrition_compliance"``.
    """

    __tablename__ = "achievement_progress"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    progress_type: Mapped[str] = mapped_column(String(50), nullable=False)
    current_value: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    metadata_: Mapped[Optional[dict[str, Any]]] = mapped_column(
        "metadata",
        JSONB,
        nullable=True,
        server_default=text("'{}'::jsonb"),
    )

    __table_args__ = (
        UniqueConstraint("user_id", "progress_type", name="uq_user_progress_type"),
        Index("ix_achievement_progress_user_id", "user_id"),
    )


class StreakFreeze(Base):
    """Records a streak freeze usage for a user on a specific date."""

    __tablename__ = "streak_freezes"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    freeze_date: Mapped[date] = mapped_column(Date, nullable=False)
    used_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )
    month: Mapped[str] = mapped_column(String(7), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "freeze_date", name="uq_streak_freeze_user_date"),
        Index("ix_streak_freezes_user_id", "user_id"),
        Index("ix_streak_freezes_user_month", "user_id", "month"),
    )
