"""SQLAlchemy models for device tokens and notification preferences."""

from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.base_model import Base


class DeviceToken(Base):
    """A user's registered push-notification device token (FCM / APNs).

    Requirement 7.1, 7.4: Store device push tokens per user.
    """

    __tablename__ = "device_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    platform: Mapped[str] = mapped_column(String(10), nullable=False)
    token: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

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
        ForeignKey("users.id"), nullable=False, unique=True,
    )
    push_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    coaching_reminders: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    subscription_alerts: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    __table_args__ = (
        UniqueConstraint("user_id", name="uq_notification_preferences_user_id"),
        Index("ix_notification_prefs_user_id", "user_id", unique=True),
    )
