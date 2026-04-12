"""SQLAlchemy models for device tokens, notification preferences, and notification log."""

from __future__ import annotations

import uuid
from datetime import datetime, time
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.base_model import Base


class DeviceToken(Base):
    """A user's registered push-notification device token (FCM / APNs / Expo).

    Requirement 7.1, 7.4: Store device push tokens per user.
    """

    __tablename__ = "device_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    platform: Mapped[str] = mapped_column(String(10), nullable=False)
    token: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    expo_push_token: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_device_tokens_user_id", "user_id"),
        Index("ix_device_tokens_token", "token", unique=True),
    )


class NotificationPreference(Base):
    """Per-user notification preference toggles.

    Requirement 7.5: Respect user notification preferences.
    """

    __tablename__ = "notification_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    push_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    coaching_reminders: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    subscription_alerts: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    workout_reminders: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    meal_reminders: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    pr_celebrations: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    weekly_checkin_alerts: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    volume_warnings: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    quiet_hours_start: Mapped[Optional[time]] = mapped_column(nullable=True)
    quiet_hours_end: Mapped[Optional[time]] = mapped_column(nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", name="uq_notification_preferences_user_id"),
        Index("ix_notification_prefs_user_id", "user_id", unique=True),
    )


class NotificationLog(Base):
    """Log of all sent push notifications for history and analytics."""

    __tablename__ = "notification_log"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    data: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default="now()",
        nullable=False,
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    clicked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_notification_log_user_sent", "user_id", "sent_at"),
        Index("ix_notification_log_type", "type"),
        # Audit fix 8.5 — composite index for unread notification queries
        Index("ix_notification_log_user_read", "user_id", "read_at"),
    )
