"""Business logic for device token management, preferences, and push notifications."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.feature_flags.service import FeatureFlagService
from src.modules.notifications.models import DeviceToken, NotificationLog, NotificationPreference
from src.modules.notifications.schemas import (
    DeviceTokenCreate,
    NotificationPreferenceUpdate,
)
from src.services.push_notifications import PushNotificationService
from src.shared.errors import NotFoundError
from src.shared.pagination import PaginatedResult, PaginationParams

logger = logging.getLogger("hypertrophy_os.notifications")

# Mapping from notification_type to NotificationPreference field name
_TYPE_TO_PREF: dict[str, str] = {
    "workout_reminder": "workout_reminders",
    "pr_celebration": "pr_celebrations",
    "weekly_checkin": "weekly_checkin_alerts",
    "volume_warning": "volume_warnings",
    "meal_reminder": "meal_reminders",
}


class NotificationService:
    """Service layer for device tokens, preferences, notification history, and push delivery."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ------------------------------------------------------------------
    # Device token management
    # ------------------------------------------------------------------

    async def register_device(
        self, user_id: uuid.UUID, data: DeviceTokenCreate,
    ) -> DeviceToken:
        """Insert or update a device token (upsert on token value)."""
        stmt = select(DeviceToken).where(DeviceToken.token == data.token)
        result = await self.session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing is not None:
            existing.user_id = user_id
            existing.platform = data.platform
            existing.is_active = True
            existing.last_used_at = datetime.now(timezone.utc)
            await self.session.flush()
            return existing

        device = DeviceToken(
            user_id=user_id,
            platform=data.platform,
            token=data.token,
            is_active=True,
            last_used_at=datetime.now(timezone.utc),
        )
        self.session.add(device)
        await self.session.flush()
        return device

    async def unregister_device(
        self, user_id: uuid.UUID, token_id: uuid.UUID,
    ) -> None:
        """Delete a device token owned by the given user."""
        stmt = select(DeviceToken).where(
            DeviceToken.id == token_id, DeviceToken.user_id == user_id,
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

    async def get_preferences(self, user_id: uuid.UUID) -> NotificationPreference:
        """Return preferences, creating defaults if needed."""
        stmt = select(NotificationPreference).where(NotificationPreference.user_id == user_id)
        result = await self.session.execute(stmt)
        prefs = result.scalar_one_or_none()
        if prefs is not None:
            return prefs

        prefs = NotificationPreference(user_id=user_id)
        self.session.add(prefs)
        await self.session.flush()
        return prefs

    async def update_preferences(
        self, user_id: uuid.UUID, data: NotificationPreferenceUpdate,
    ) -> NotificationPreference:
        """Partial update of notification preferences."""
        prefs = await self.get_preferences(user_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(prefs, field, value)
        await self.session.flush()
        return prefs

    # ------------------------------------------------------------------
    # Notification history
    # ------------------------------------------------------------------

    async def get_notification_history(
        self, user_id: uuid.UUID, pagination: PaginationParams,
    ) -> PaginatedResult:
        """Return paginated notification history, newest first."""
        base = select(NotificationLog).where(NotificationLog.user_id == user_id)

        count_stmt = select(func.count()).select_from(base.subquery())
        total_count = (await self.session.execute(count_stmt)).scalar_one()

        items_stmt = (
            base.order_by(NotificationLog.sent_at.desc())
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        rows = (await self.session.execute(items_stmt)).scalars().all()

        from src.modules.notifications.schemas import NotificationLogResponse

        return PaginatedResult(
            items=[NotificationLogResponse.model_validate(r) for r in rows],
            total_count=total_count,
            page=pagination.page,
            limit=pagination.limit,
        )

    async def mark_as_read(
        self, user_id: uuid.UUID, notification_ids: list[uuid.UUID],
    ) -> int:
        """Mark notifications as read. Returns count of updated rows."""
        now = datetime.now(timezone.utc)
        stmt = (
            update(NotificationLog)
            .where(
                NotificationLog.user_id == user_id,
                NotificationLog.id.in_(notification_ids),
                NotificationLog.read_at.is_(None),
            )
            .values(read_at=now)
        )
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # Push delivery
    # ------------------------------------------------------------------

    async def send_push(
        self,
        user_id: uuid.UUID,
        title: str,
        body: str,
        notification_type: str = "general",
        data: dict | None = None,
    ) -> int:
        """Send push notification respecting feature flag, quiet hours, and user preferences.

        Returns the number of attempted deliveries (0 if blocked by any check).
        """
        # H1: Feature flag gate
        ff_svc = FeatureFlagService(self.session)
        if not await ff_svc.is_feature_enabled("push_notifications"):
            return 0

        prefs = await self.get_preferences(user_id)
        if not prefs.push_enabled:
            return 0

        # H2: Quiet hours check — compare in user's local timezone
        if prefs.quiet_hours_start is not None and prefs.quiet_hours_end is not None:
            from src.modules.user.models import UserProfile

            profile_result = await self.session.execute(
                select(UserProfile).where(UserProfile.user_id == user_id)
            )
            profile = profile_result.scalar_one_or_none()
            user_tz = ZoneInfo(profile.timezone) if profile and profile.timezone else timezone.utc
            now_time = datetime.now(user_tz).time()
            start, end = prefs.quiet_hours_start, prefs.quiet_hours_end
            if start <= end:
                if start <= now_time <= end:
                    return 0
            else:  # wraps midnight, e.g. 22:00 → 06:00
                if now_time >= start or now_time <= end:
                    return 0

        # H3: Per-notification-type preference check
        pref_field = _TYPE_TO_PREF.get(notification_type)
        if pref_field is not None and not getattr(prefs, pref_field, True):
            return 0

        push_svc = PushNotificationService(self.session)
        return await push_svc.send_notification(
            user_id=user_id,
            title=title,
            body=body,
            data=data,
            notification_type=notification_type,
        )
