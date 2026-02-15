"""Business logic for payment and subscription management.

Implements the subscription state machine, provider routing, webhook
handling, and freemium gating support.
"""

from __future__ import annotations
from typing import Optional

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.payments.models import PaymentTransaction, Subscription
from src.modules.payments.provider_interface import (
    WebhookEvent,
    get_provider_for_region,
)
from src.modules.payments.schemas import (
    CancelRequest,
    RefundRequest,
    SubscribeRequest,
)
from src.shared.errors import NotFoundError, UnprocessableError
from src.shared.types import (
    PaymentTransactionStatus,
    PaymentTransactionType,
    SubscriptionStatus,
)


# ---------------------------------------------------------------------------
# Subscription state machine — valid transitions
# ---------------------------------------------------------------------------

VALID_TRANSITIONS: dict[str, set[str]] = {
    SubscriptionStatus.FREE: {SubscriptionStatus.PENDING_PAYMENT},
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

    Coordinates between the abstract PaymentProvider interface and the
    platform's Subscription / PaymentTransaction models.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ------------------------------------------------------------------
    # Subscription lifecycle
    # ------------------------------------------------------------------

    async def initiate_subscription(
        self,
        user_id: uuid.UUID,
        data: SubscribeRequest,
    ) -> Subscription:
        """Start a subscription flow for the user.

        Creates or updates the user's subscription record and transitions
        status from free → pending_payment.

        Requirement 10.1: Delegate to the appropriate provider based on region.
        Requirement 10.2: Create a Subscription record decoupled from provider.
        """
        # Get or create subscription record
        subscription = await self._get_or_create_subscription(user_id)

        validate_transition(subscription.status, SubscriptionStatus.PENDING_PAYMENT)

        subscription.status = SubscriptionStatus.PENDING_PAYMENT
        subscription.plan_id = data.plan_id
        subscription.region = data.region
        subscription.currency = data.currency

        # Determine provider from region
        provider = get_provider_for_region(data.region)
        subscription.provider_name = type(provider).__name__

        await self.session.flush()
        return subscription

    async def handle_webhook(
        self,
        provider_name: str,
        payload: bytes,
        signature: str,
    ) -> WebhookEvent:
        """Process an incoming webhook from a payment provider.

        Verifies the signature, parses the event, and updates the
        subscription status accordingly.

        Requirement 10.3: Verify webhook signature before processing.
        Requirement 10.8: Reject if signature verification fails.
        """
        # Instantiate the correct provider
        from src.modules.payments.stripe_provider import StripeProvider
        from src.modules.payments.razorpay_provider import RazorpayProvider

        provider_map = {
            "stripe": StripeProvider,
            "razorpay": RazorpayProvider,
        }
        provider_cls = provider_map.get(provider_name.lower())
        if provider_cls is None:
            raise UnprocessableError(f"Unknown payment provider: {provider_name}")

        provider = provider_cls()

        # verify_webhook raises UnprocessableError on invalid signature
        event = await provider.verify_webhook(payload, signature)

        # Update subscription if we can find it
        if event.provider_subscription_id:
            await self._process_webhook_event(event)

        return event

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

    async def request_refund(
        self,
        user_id: uuid.UUID,
        data: RefundRequest,
    ) -> PaymentTransaction:
        """Record a refund request for a subscription.

        Requirement 10.5: Record the transaction in PaymentTransactions.
        """
        subscription = await self._get_subscription_or_raise(
            user_id, data.subscription_id
        )

        transaction = PaymentTransaction(
            subscription_id=subscription.id,
            user_id=user_id,
            provider_name=subscription.provider_name,
            provider_transaction_id=None,
            amount=data.amount or 0.0,
            currency=subscription.currency,
            type=PaymentTransactionType.REFUND,
            status=PaymentTransactionStatus.PENDING,
        )
        self.session.add(transaction)
        await self.session.flush()
        return transaction

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
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_or_create_subscription(
        self, user_id: uuid.UUID
    ) -> Subscription:
        """Get existing subscription or create a new free one."""
        existing = await self.get_subscription_status(user_id)
        if existing is not None:
            return existing

        subscription = Subscription(
            user_id=user_id,
            provider_name="none",
            status=SubscriptionStatus.FREE,
            currency="USD",
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
        stmt = select(Subscription).where(
            Subscription.provider_subscription_id == event.provider_subscription_id
        )
        result = await self.session.execute(stmt)
        subscription = result.scalar_one_or_none()
        if subscription is None:
            return  # Unknown subscription — ignore

        event_type = event.event_type.lower()

        # Map common webhook events to status transitions
        transition_map: dict[str, str] = {
            "payment_intent.succeeded": SubscriptionStatus.ACTIVE,
            "invoice.paid": SubscriptionStatus.ACTIVE,
            "subscription.activated": SubscriptionStatus.ACTIVE,
            "invoice.payment_failed": SubscriptionStatus.PAST_DUE,
            "subscription.cancelled": SubscriptionStatus.CANCELLED,
            "payment.failed": SubscriptionStatus.FREE,
        }

        new_status = transition_map.get(event_type)
        if new_status is None:
            return  # Unhandled event type

        try:
            validate_transition(subscription.status, new_status)
            subscription.status = new_status
            await self.session.flush()
        except UnprocessableError:
            pass  # Invalid transition — ignore silently for webhooks
