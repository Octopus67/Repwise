"""Stripe payment provider implementation.

Implements the PaymentProvider interface for Stripe (US/global, USD).
Uses the Stripe SDK for subscription management, cancellation, and refunds.
The verify_webhook method implements real HMAC-SHA256 signature checking.

Requirement 10.7: USD pricing via Stripe.
"""

from __future__ import annotations
from typing import Optional

import hashlib
import hmac
import json
import time

import stripe

from src.config.settings import settings
from src.modules.payments.provider_interface import (
    CreateSubscriptionParams,
    PaymentProvider,
    ProviderSubscription,
    RefundResult,
    WebhookEvent,
)
from src.shared.errors import ProviderError, UnprocessableError

# Map internal plan IDs to Stripe Price IDs.
# Replace placeholder values with real Stripe Dashboard price IDs in production.
STRIPE_PRICE_MAP: dict[str, str] = {
    "monthly": "price_monthly_placeholder",
    "annual": "price_annual_placeholder",
}


class StripeProvider(PaymentProvider):
    """Stripe payment provider for US/global markets.

    Uses HMAC-SHA256 for webhook signature verification following
    Stripe's v1 signature scheme.
    """

    def __init__(
        self,
        api_key: str = "",
        webhook_secret: str = "whsec_test_secret",
    ) -> None:
        self.api_key = api_key or settings.STRIPE_API_KEY
        self.webhook_secret = webhook_secret
        stripe.api_key = self.api_key

    async def create_subscription(
        self, params: CreateSubscriptionParams
    ) -> ProviderSubscription:
        """Create a Stripe subscription via Checkout Session.

        Maps the internal plan_id to a Stripe price ID and creates a
        Checkout Session in subscription mode. Returns the session URL
        as provider_subscription_id with status "pending".

        Requirement 10.1: Delegate to Stripe for US/global subscriptions.
        """
        plan_price_id = STRIPE_PRICE_MAP.get(params.plan_id)
        if not plan_price_id:
            raise ProviderError(
                f"Unknown plan_id '{params.plan_id}' — not found in STRIPE_PRICE_MAP"
            )

        try:
            session = stripe.checkout.Session.create(
                mode="subscription",
                line_items=[{"price": plan_price_id, "quantity": 1}],
                customer_email=params.customer_email,
                metadata=params.metadata,
                success_url="https://hypertrophyos.com/payment/success",
                cancel_url="https://hypertrophyos.com/payment/cancel",
            )
        except stripe.StripeError as exc:
            raise ProviderError(f"Stripe error: {exc}") from exc

        return ProviderSubscription(
            provider_subscription_id=session.url or session.id,
            provider_customer_id=session.customer or "",
            status="pending",
        )

    async def verify_webhook(
        self, payload: bytes, signature: str
    ) -> WebhookEvent:
        """Verify Stripe webhook signature using HMAC-SHA256.

        Stripe sends signatures in the format:
            t=<timestamp>,v1=<hmac_hex>

        We recompute the HMAC over "<timestamp>.<payload>" using the
        webhook secret and compare.

        Requirement 10.3, 10.8: Verify signature before processing.
        """
        try:
            parts = dict(
                part.split("=", 1) for part in signature.split(",") if "=" in part
            )
        except (ValueError, AttributeError):
            raise UnprocessableError("Invalid webhook signature format")

        timestamp = parts.get("t")
        v1_signature = parts.get("v1")

        if not timestamp or not v1_signature:
            raise UnprocessableError("Missing timestamp or signature in webhook header")

        # Verify signature: HMAC-SHA256 over "<timestamp>.<payload>"
        signed_payload = f"{timestamp}.".encode() + payload
        expected_sig = hmac.new(
            self.webhook_secret.encode(),
            signed_payload,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, v1_signature):
            raise UnprocessableError("Webhook signature verification failed")

        # Parse the payload
        try:
            event_data = json.loads(payload)
        except json.JSONDecodeError:
            raise UnprocessableError("Invalid webhook payload JSON")

        return WebhookEvent(
            event_type=event_data.get("type", "unknown"),
            provider_subscription_id=event_data.get("subscription_id"),
            provider_transaction_id=event_data.get("transaction_id"),
            amount=event_data.get("amount"),
            currency=event_data.get("currency"),
            metadata=event_data.get("metadata", {}),
        )

    async def cancel_subscription(
        self, provider_subscription_id: str
    ) -> None:
        """Cancel a Stripe subscription.

        Requirement 10.4: Invoke Stripe's cancellation API.
        """
        try:
            stripe.Subscription.cancel(provider_subscription_id)
        except stripe.StripeError as exc:
            raise ProviderError(f"Stripe cancellation error: {exc}") from exc

    async def refund(
        self,
        provider_transaction_id: str,
        amount: Optional[float] = None,
    ) -> RefundResult:
        """Request a refund via Stripe.

        Converts the amount from dollars to cents for the Stripe API.

        Requirement 10.5: Invoke Stripe's refund API.
        """
        try:
            refund_params: dict = {"payment_intent": provider_transaction_id}
            if amount is not None:
                refund_params["amount"] = int(amount * 100)

            result = stripe.Refund.create(**refund_params)
        except stripe.StripeError as exc:
            raise ProviderError(f"Stripe refund error: {exc}") from exc

        return RefundResult(
            provider_transaction_id=result.id,
            amount=(result.amount or 0) / 100,
            currency=result.currency or "usd",
            status=result.status or "pending",
        )
