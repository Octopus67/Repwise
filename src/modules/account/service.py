"""Business logic for account deletion with 30-day grace period.

Requirement 22.1: 30-day grace period on deletion request.
Requirement 22.2: Permanent deletion after grace period.
Requirement 22.3: Reactivation within grace period.
Requirement 22.4: Cancel active subscription before deletion.
Requirement 22.5: Log deletion request in audit log.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.auth.models import User
from src.modules.payments.models import Subscription
from src.shared.audit import AuditLog
from src.shared.errors import NotFoundError, UnprocessableError
from src.shared.types import AuditAction, SubscriptionStatus

GRACE_PERIOD_DAYS = 30


class AccountService:
    """Service layer for account deletion and reactivation."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def request_deletion(self, user_id: uuid.UUID) -> dict:
        """Deactivate account and start 30-day grace period.

        Sets deleted_at on the user record and cancels any active subscription.

        Requirement 22.1, 22.4, 22.5.
        """
        user = await self._get_user_or_raise(user_id)

        if user.deleted_at is not None:
            raise UnprocessableError("Account is already deactivated")

        now = datetime.now(timezone.utc)
        user.deleted_at = now

        # Cancel active subscription (Requirement 22.4)
        await self._cancel_active_subscription(user_id)

        # Audit log (Requirement 22.5)
        audit = AuditLog(
            user_id=user_id,
            action=AuditAction.DELETE.value,
            entity_type="users",
            entity_id=user_id,
            changes={"action": "account_deletion_requested", "grace_period_days": GRACE_PERIOD_DAYS},
        )
        self.session.add(audit)
        await self.session.flush()

        permanent_date = now + timedelta(days=GRACE_PERIOD_DAYS)
        return {
            "message": "Account deactivated. You have 30 days to reactivate.",
            "deleted_at": now,
            "permanent_deletion_date": permanent_date,
            "grace_period_days": GRACE_PERIOD_DAYS,
        }

    async def reactivate(self, user_id: uuid.UUID) -> dict:
        """Reactivate account within grace period.

        Requirement 22.3: Restore full access to all data.
        """
        # Fetch user including soft-deleted
        stmt = select(User).where(User.id == user_id)
        result = await self.session.execute(stmt)
        user = result.scalar_one_or_none()

        if user is None:
            raise NotFoundError("User not found")

        if user.deleted_at is None:
            raise UnprocessableError("Account is not deactivated")

        # Check grace period
        now = datetime.now(timezone.utc)
        deadline = user.deleted_at + timedelta(days=GRACE_PERIOD_DAYS)
        if now > deadline:
            raise UnprocessableError(
                "Grace period has expired. Account cannot be reactivated."
            )

        user.deleted_at = None

        # Audit log
        audit = AuditLog(
            user_id=user_id,
            action=AuditAction.UPDATE.value,
            entity_type="users",
            entity_id=user_id,
            changes={"action": "account_reactivated"},
        )
        self.session.add(audit)
        await self.session.flush()

        return {
            "message": "Account reactivated successfully.",
            "reactivated_at": now,
        }

    async def permanently_delete_expired_accounts(self) -> int:
        """Background task: permanently delete accounts past grace period.

        Requirement 22.2: Delete all user data after 30-day grace period.
        Returns the number of accounts permanently deleted.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=GRACE_PERIOD_DAYS)

        stmt = select(User).where(
            User.deleted_at.isnot(None),
            User.deleted_at <= cutoff,
        )
        result = await self.session.execute(stmt)
        expired_users = list(result.scalars().all())

        count = 0
        for user in expired_users:
            # Hard delete the user — cascading deletes handle related data
            await self.session.delete(user)
            count += 1

        if count > 0:
            await self.session.flush()

        return count

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_user_or_raise(self, user_id: uuid.UUID) -> User:
        """Fetch a non-deleted user or raise NotFoundError."""
        stmt = select(User).where(User.id == user_id, User.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        user = result.scalar_one_or_none()
        if user is None:
            raise NotFoundError("User not found")
        return user

    async def _cancel_active_subscription(self, user_id: uuid.UUID) -> None:
        """Cancel any active subscription for the user."""
        stmt = select(Subscription).where(
            Subscription.user_id == user_id,
            Subscription.status.in_([
                SubscriptionStatus.ACTIVE,
                SubscriptionStatus.PAST_DUE,
                SubscriptionStatus.PENDING_PAYMENT,
            ]),
            Subscription.deleted_at.is_(None),
        )
        result = await self.session.execute(stmt)
        subscriptions = list(result.scalars().all())
        for sub in subscriptions:
            sub.status = SubscriptionStatus.CANCELLED
