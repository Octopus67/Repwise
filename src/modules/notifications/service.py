"""Business logic for device token management and push notifications.

Handles device registration, notification preferences, and push delivery
(stubbed — real FCM/APNs integration is a future step).
"""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.notifications.models import DeviceToken, NotificationPreference
from src.modules.notifications.schemas import (
    DeviceTokenCreate,
    NotificationPreferenceUpdate,
)
from src.shared.errors import NotFoundError

logger = logging.getLogger("hypertrophy_os.notifications")


class NotificationService:
    """Service layer for device tokens and notification preferences.

    Requirement 7.1: Register / unregister device tokens.
    Requirement 7.2: Send push notifications (stubbed).
    Requirement 7.3: Delivery attempt tracking.
    Requirement 7.4: Token management.
    Requirement 7.5: Respect user notification preferences.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ------------------------------------------------------------------
    # Device token management
    # ------------------------------------------------------------------

    async def register_device(
        self,
        user_id: uuid.UUID,
        data: DeviceTokenCreate,
    ) -> DeviceToken:
        """Insert or update a device token (upsert on token value).

        If the token already exists for a different user, reassign it.
        """
        stmt = select(DeviceToken).where(DeviceToken.token == data.token)
        result = await self.session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing is not None:
            existing.user_id = user_id
            existing.platform = data.platform
            existing.is_active = True
            await self.session.flush()
            return existing

        device = DeviceToken(
            user_id=user_id,
            platform=data.platform,
            token=data.token,
            is_active=True,
        )
        self.session.add(device)
        await self.session.flush()
        return device

    async def unregister_device(
        self,
        user_id: uuid.UUID,
        token_id: uuid.UUID,
    ) -> None:
        """Delete a device token owned by the given user."""
        stmt = (
            select(DeviceToken)
            .where(DeviceToken.id == token_id)
            .where(DeviceToken.user_id == user_id)
        )
        result = await self.session.execute(stmt)
        device = result.scalar_one_or_none()
        if device is None:
            raise NotFoundError("Device token not found")
        await self.session.delete(device)
        await self.session.flush()

    async def deactivate_token(self, token_id: uuid.UUID) -> None:
        """Set a device token's is_active flag to False."""
        stmt = select(DeviceToken).where(DeviceToken.id == token_id)
        result = await self.session.execute(stmt)
        device = result.scalar_one_or_none()
        if device is None:
            raise NotFoundError("Device token not found")
        device.is_active = False
        await self.session.flush()

    # ------------------------------------------------------------------
    # Notification preferences
    # ------------------------------------------------------------------

    async def get_preferences(
        self,
        user_id: uuid.UUID,
    ) -> NotificationPreference:
        """Return the user's notification preferences, creating defaults if needed."""
        stmt = select(NotificationPreference).where(
            NotificationPreference.user_id == user_id
        )
        result = await self.session.execute(stmt)
        prefs = result.scalar_one_or_none()

        if prefs is not None:
            return prefs

        prefs = NotificationPreference(
            user_id=user_id,
            push_enabled=True,
            coaching_reminders=True,
            subscription_alerts=True,
        )
        self.session.add(prefs)
        await self.session.flush()
        return prefs

    async def update_preferences(
        self,
        user_id: uuid.UUID,
        data: NotificationPreferenceUpdate,
    ) -> NotificationPreference:
        """Partial update of notification preferences."""
        prefs = await self.get_preferences(user_id)
        updates = data.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(prefs, field, value)
        await self.session.flush()
        return prefs

    # ------------------------------------------------------------------
    # Push delivery (stub)
    # ------------------------------------------------------------------

    async def send_push(
        self,
        user_id: uuid.UUID,
        title: str,
        body: str,
    ) -> int:
        """Attempt to deliver a push notification to all active devices.

        Returns the number of attempted deliveries (0 if push is disabled).
        Currently stubbed — logs instead of calling FCM/APNs.
        """
        prefs = await self.get_preferences(user_id)
        if not prefs.push_enabled:
            return 0

        stmt = (
            select(DeviceToken)
            .where(DeviceToken.user_id == user_id)
            .where(DeviceToken.is_active.is_(True))
        )
        result = await self.session.execute(stmt)
        tokens = result.scalars().all()

        count = 0
        for token in tokens:
            logger.info(
                "Push stub: user=%s platform=%s title=%s body=%s token=%s",
                user_id,
                token.platform,
                title,
                body,
                token.token[:8] + "...",
            )
            count += 1

        return count
