"""Razorpay payment provider implementation.

Implements the PaymentProvider interface for Razorpay (India, INR/UPI).
All methods are stubs raising NotImplementedError — verify_webhook
implements real HMAC-SHA256 signature checking.

Requirement 10.7: INR pricing via Razorpay, with UPI as a payment method.
"""

from __future__ import annotations
from typing import Optional

import hashlib
import hmac
import json

from src.modules.payments.provider_interface import (
    CreateSubscriptionParams,
    PaymentProvider,
    ProviderSubscription,
    RefundResult,
    WebhookEvent,
)
from src.shared.errors import UnprocessableError


class RazorpayProvider(PaymentProvider):
    """Razorpay payment provider for Indian market.

    Uses HMAC-SHA256 for webhook signature verification following
    Razorpay's X-Razorpay-Signature scheme.
    """

    def __init__(self, webhook_secret: str = "rzp_test_secret") -> None:
        self.webhook_secret = webhook_secret

    async def create_subscription(
        self, params: CreateSubscriptionParams
    ) -> ProviderSubscription:
        """Create a Razorpay subscription.

        Stub: raises NotImplementedError until Razorpay SDK is integrated.
        """
        raise NotImplementedError(
            "Razorpay create_subscription requires Razorpay SDK integration"
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

        Stub: raises NotImplementedError until Razorpay SDK is integrated.
        """
        raise NotImplementedError(
            "Razorpay cancel_subscription requires Razorpay SDK integration"
        )

    async def refund(
        self,
        provider_transaction_id: str,
        amount: Optional[float] = None,
    ) -> RefundResult:
        """Request a refund via Razorpay.

        Stub: raises NotImplementedError until Razorpay SDK is integrated.
        """
        raise NotImplementedError(
            "Razorpay refund requires Razorpay SDK integration"
        )
