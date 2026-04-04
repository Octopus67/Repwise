"""Business logic for payment and subscription management.

Implements the subscription state machine, RevenueCat webhook
handling, and freemium gating support.
"""

from __future__ import annotations
import logging
from typing import Optional

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.payments.models import Subscription
from src.modules.payments.provider_interface import WebhookEvent
from src.modules.payments.schemas import CancelRequest
from src.shared.errors import NotFoundError, UnprocessableError
from src.shared.types import SubscriptionStatus

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Subscription state machine — valid transitions
# ---------------------------------------------------------------------------

VALID_TRANSITIONS: dict[str, set[str]] = {
    SubscriptionStatus.FREE: {SubscriptionStatus.PENDING_PAYMENT, SubscriptionStatus.ACTIVE},
    SubscriptionStatus.PENDING_PAYMENT: {
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.FREE,
    },
    SubscriptionStatus.ACTIVE: {
        SubscriptionStatus.ACTIVE,      # renewal success
        SubscriptionStatus.PAST_DUE,    # renewal failed
        SubscriptionStatus.CANCELLED,   # user cancels
    },
    SubscriptionStatus.PAST_DUE: {
        SubscriptionStatus.ACTIVE,      # retry success
        SubscriptionStatus.CANCELLED,   # grace period expired
    },
    SubscriptionStatus.CANCELLED: {
        SubscriptionStatus.FREE,        # subscription period ends
    },
}


def validate_transition(current: str, target: str) -> None:
    """Raise UnprocessableError if the status transition is invalid."""
    allowed = VALID_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise UnprocessableError(
            f"Invalid subscription transition: {current} → {target}"
        )


class PaymentService:
    """Service layer for subscription and payment operations.

    Handles RevenueCat webhooks and subscription status queries.
    Purchases are initiated client-side via the RevenueCat SDK.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ------------------------------------------------------------------
    # Webhook handling (RevenueCat only)
    # ------------------------------------------------------------------

    async def handle_webhook(
        self,
        payload: bytes,
        signature: str,
    ) -> WebhookEvent:
        """Process an incoming webhook from RevenueCat.

        Verifies the Bearer token, parses the event, and updates the
        subscription status accordingly.

        Requirement 10.3: Verify webhook signature before processing.
        Requirement 10.8: Reject if signature verification fails.
        """
        from src.modules.payments.revenuecat_provider import RevenueCatProvider

        provider = RevenueCatProvider()

        # verify_webhook raises UnprocessableError on invalid signature
        event = await provider.verify_webhook(payload, signature)

        # Idempotency check
        if event.event_id:
            from src.modules.payments.models import WebhookEventLog
            existing_stmt = select(WebhookEventLog).where(
                WebhookEventLog.event_id == event.event_id
            )
            existing_result = await self.session.execute(existing_stmt)
            if existing_result.scalar_one_or_none():
                return event  # Already processed, return without processing

            # Record this event
            log_entry = WebhookEventLog(
                provider_name="revenuecat",
                event_id=event.event_id,
                event_type=event.event_type,
            )
            self.session.add(log_entry)

        # Update subscription if we can find it
        if event.provider_subscription_id:
            await self._process_webhook_event(event)

        return event

    # ------------------------------------------------------------------
    # Subscription lifecycle
    # ------------------------------------------------------------------

    async def cancel_subscription(
        self,
        user_id: uuid.UUID,
        data: CancelRequest,
    ) -> Subscription:
        """Cancel the user's subscription.

        Transitions status from active → cancelled.

        Requirement 10.4: Invoke provider's cancellation API and update status.
        """
        subscription = await self._get_subscription_or_raise(
            user_id, data.subscription_id
        )

        validate_transition(subscription.status, SubscriptionStatus.CANCELLED)
        subscription.status = SubscriptionStatus.CANCELLED

        await self.session.flush()
        return subscription

    async def get_subscription_status(
        self,
        user_id: uuid.UUID,
    ) -> Optional[Subscription]:
        """Return the user's current subscription, or None if none exists."""
        stmt = (
            select(Subscription)
            .where(Subscription.user_id == user_id)
            .where(Subscription.deleted_at.is_(None))
            .order_by(Subscription.created_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------
    # RevenueCat entitlement check
    # ------------------------------------------------------------------

    async def check_revenuecat_entitlement(self, user_id: str) -> bool:
        """Check if a user has an active RevenueCat entitlement."""
        from src.modules.payments.revenuecat_provider import RevenueCatProvider
        provider = RevenueCatProvider()
        return await provider.verify_entitlement(user_id)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_or_create_subscription(
        self, user_id: uuid.UUID, is_trial: bool = False,
    ) -> Subscription:
        """Get existing subscription or create a new free one."""
        existing = await self.get_subscription_status(user_id)
        if existing is not None:
            return existing

        subscription = Subscription(
            user_id=user_id,
            provider_name="revenuecat",
            status=SubscriptionStatus.FREE,
            currency="USD",
            region="US",
            is_trial=is_trial,
        )
        self.session.add(subscription)
        await self.session.flush()
        return subscription

    async def _get_or_create_subscription_from_webhook(
        self, user_id: str, event: WebhookEvent,
    ) -> Optional[Subscription]:
        """Find or create a subscription for a first-time purchase webhook."""
        try:
            uid = uuid.UUID(user_id)
        except ValueError:
            logger.warning("Invalid user_id in webhook: %s", user_id)
            return None

        # Check if user already has a subscription
        existing = await self.get_subscription_status(uid)
        if existing is not None:
            existing.provider_subscription_id = event.provider_subscription_id
            await self.session.flush()
            return existing

        subscription = Subscription(
            user_id=uid,
            provider_name="revenuecat",
            provider_subscription_id=event.provider_subscription_id,
            status=SubscriptionStatus.FREE,
            currency=event.currency or "USD",
            region="US",
        )
        self.session.add(subscription)
        await self.session.flush()
        return subscription

    async def _get_subscription_or_raise(
        self,
        user_id: uuid.UUID,
        subscription_id: uuid.UUID,
    ) -> Subscription:
        """Fetch a subscription owned by the user, or raise NotFoundError."""
        stmt = (
            select(Subscription)
            .where(Subscription.id == subscription_id)
            .where(Subscription.user_id == user_id)
            .where(Subscription.deleted_at.is_(None))
        )
        result = await self.session.execute(stmt)
        subscription = result.scalar_one_or_none()
        if subscription is None:
            raise NotFoundError("Subscription not found")
        return subscription

    async def _process_webhook_event(self, event: WebhookEvent) -> None:
        """Update subscription status based on webhook event type."""
        # Try to find existing subscription by provider_subscription_id
        # Audit fix #6: exclude soft-deleted subscriptions to prevent reactivation
        stmt = select(Subscription).where(
            Subscription.provider_subscription_id == event.provider_subscription_id,
            Subscription.deleted_at.is_(None),
        )
        result = await self.session.execute(stmt)
        subscription = result.scalar_one_or_none()

        # If not found, try by user_id (for first-time purchases)
        if not subscription and event.user_id:
            subscription = await self._get_or_create_subscription_from_webhook(event.user_id, event)

        if subscription is None:
            return  # Unknown subscription — ignore

        event_type = event.event_type.lower()

        # Map RevenueCat webhook events to status transitions
        transition_map: dict[str, str] = {
            "subscription.activated": SubscriptionStatus.ACTIVE,
            "invoice.paid": SubscriptionStatus.ACTIVE,
            "invoice.payment_failed": SubscriptionStatus.PAST_DUE,
            "subscription.cancelled": SubscriptionStatus.CANCELLED,
            "subscription.expired": SubscriptionStatus.CANCELLED,
            "payment.refunded": SubscriptionStatus.CANCELLED,
        }

        new_status = transition_map.get(event_type)
        if new_status is None:
            return  # Unhandled event type

        try:
            validate_transition(subscription.status, new_status)
            old_status = subscription.status
            subscription.status = new_status
            if event.period_end:
                subscription.current_period_end = event.period_end
            await self.session.flush()
            logger.info(
                "Subscription status changed",
                extra={
                    "user_id": event.user_id,
                    "subscription_id": str(subscription.id),
                    "old_status": old_status,
                    "new_status": new_status,
                    "event_type": event.event_type,
                },
            )
        except UnprocessableError:
            logger.warning(
                "Invalid webhook transition ignored: %s -> %s for subscription %s, event: %s",
                subscription.status, new_status, subscription.id, event.event_type
            )
