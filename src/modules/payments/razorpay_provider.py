"""Razorpay payment provider implementation.

Implements the PaymentProvider interface for Razorpay (India, INR/UPI).
Uses the Razorpay SDK for subscription management, cancellation, and refunds.
The verify_webhook method implements real HMAC-SHA256 signature checking.

Requirement 10.7: INR pricing via Razorpay, with UPI as a payment method.
"""

from __future__ import annotations
from typing import Optional

import hashlib
import hmac
import json

import razorpay

from src.config.settings import settings
from src.modules.payments.provider_interface import (
    CreateSubscriptionParams,
    PaymentProvider,
    ProviderSubscription,
    RefundResult,
    WebhookEvent,
)
from src.shared.errors import ProviderError, UnprocessableError

# Map internal plan IDs to Razorpay Plan IDs.
# Replace placeholder values with real Razorpay Dashboard plan IDs in production.
RAZORPAY_PLAN_MAP: dict[str, str] = {
    "monthly": "plan_monthly_placeholder",
    "annual": "plan_annual_placeholder",
}


class RazorpayProvider(PaymentProvider):
    """Razorpay payment provider for Indian market.

    Uses HMAC-SHA256 for webhook signature verification following
    Razorpay's X-Razorpay-Signature scheme.
    """

    def __init__(
        self,
        key_id: str = "",
        key_secret: str = "",
        webhook_secret: str = "rzp_test_secret",
    ) -> None:
        self.key_id = key_id or settings.RAZORPAY_KEY_ID
        self.key_secret = key_secret or settings.RAZORPAY_KEY_SECRET
        self.webhook_secret = webhook_secret
        self.client = razorpay.Client(auth=(self.key_id, self.key_secret))

    async def create_subscription(
        self, params: CreateSubscriptionParams
    ) -> ProviderSubscription:
        """Create a Razorpay subscription.

        Maps the internal plan_id to a Razorpay plan ID and creates
        a subscription via the Razorpay SDK.

        Requirement 10.1: Delegate to Razorpay for Indian subscriptions.
        """
        razorpay_plan_id = RAZORPAY_PLAN_MAP.get(params.plan_id)
        if not razorpay_plan_id:
            raise ProviderError(
                f"Unknown plan_id '{params.plan_id}' — not found in RAZORPAY_PLAN_MAP"
            )

        try:
            subscription = self.client.subscription.create({
                "plan_id": razorpay_plan_id,
                "total_count": 12,
                "quantity": 1,
                "notes": params.metadata,
            })
        except Exception as exc:
            raise ProviderError(f"Razorpay error: {exc}") from exc

        return ProviderSubscription(
            provider_subscription_id=subscription.get("id", ""),
            provider_customer_id=subscription.get("customer_id", ""),
            status=subscription.get("status", "created"),
        )

    async def verify_webhook(
        self, payload: bytes, signature: str
    ) -> WebhookEvent:
        """Verify Razorpay webhook signature using HMAC-SHA256.

        Razorpay sends the signature as a plain hex-encoded HMAC-SHA256
        of the raw request body using the webhook secret.

        Requirement 10.3, 10.8: Verify signature before processing.
        """
        if not signature:
            raise UnprocessableError("Missing webhook signature")

        expected_sig = hmac.new(
            self.webhook_secret.encode(),
            payload,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, signature):
            raise UnprocessableError("Webhook signature verification failed")

        # Parse the payload
        try:
            event_data = json.loads(payload)
        except json.JSONDecodeError:
            raise UnprocessableError("Invalid webhook payload JSON")

        return WebhookEvent(
            event_type=event_data.get("event", "unknown"),
            provider_subscription_id=event_data.get("subscription_id"),
            provider_transaction_id=event_data.get("transaction_id"),
            amount=event_data.get("amount"),
            currency=event_data.get("currency"),
            metadata=event_data.get("metadata", {}),
        )

    async def cancel_subscription(
        self, provider_subscription_id: str
    ) -> None:
        """Cancel a Razorpay subscription.

        Requirement 10.4: Invoke Razorpay's cancellation API.
        """
        try:
            self.client.subscription.cancel(provider_subscription_id)
        except Exception as exc:
            raise ProviderError(f"Razorpay cancellation error: {exc}") from exc

    async def refund(
        self,
        provider_transaction_id: str,
        amount: Optional[float] = None,
    ) -> RefundResult:
        """Request a refund via Razorpay.

        Razorpay expects amount in paise (smallest currency unit).

        Requirement 10.5: Invoke Razorpay's refund API.
        """
        try:
            refund_params: dict = {}
            if amount is not None:
                refund_params["amount"] = int(amount * 100)

            result = self.client.payment.refund(
                provider_transaction_id, refund_params
            )
        except Exception as exc:
            raise ProviderError(f"Razorpay refund error: {exc}") from exc

        return RefundResult(
            provider_transaction_id=result.get("id", ""),
            amount=result.get("amount", 0) / 100,
            currency=result.get("currency", "INR"),
            status=result.get("status", "pending"),
        )
