"""Stripe payment provider implementation.

Implements the PaymentProvider interface for Stripe (US/global, USD).
Actual Stripe API calls are stubbed with NotImplementedError — the
verify_webhook method implements real HMAC-SHA256 signature checking.

Requirement 10.7: USD pricing via Stripe.
"""

from __future__ import annotations
from typing import Optional

import hashlib
import hmac
import json
import time

from src.modules.payments.provider_interface import (
    CreateSubscriptionParams,
    PaymentProvider,
    ProviderSubscription,
    RefundResult,
    WebhookEvent,
)
from src.shared.errors import ProviderError, UnprocessableError


class StripeProvider(PaymentProvider):
    """Stripe payment provider for US/global markets.

    Uses HMAC-SHA256 for webhook signature verification following
    Stripe's v1 signature scheme.
    """

    def __init__(self, webhook_secret: str = "whsec_test_secret") -> None:
        self.webhook_secret = webhook_secret

    async def create_subscription(
        self, params: CreateSubscriptionParams
    ) -> ProviderSubscription:
        """Create a Stripe subscription.

        Stub: raises NotImplementedError until Stripe SDK is integrated.
        """
        raise NotImplementedError(
            "Stripe create_subscription requires Stripe SDK integration"
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

        Stub: raises NotImplementedError until Stripe SDK is integrated.
        """
        raise NotImplementedError(
            "Stripe cancel_subscription requires Stripe SDK integration"
        )

    async def refund(
        self,
        provider_transaction_id: str,
        amount: Optional[float] = None,
    ) -> RefundResult:
        """Request a refund via Stripe.

        Stub: raises NotImplementedError until Stripe SDK is integrated.
        """
        raise NotImplementedError(
            "Stripe refund requires Stripe SDK integration"
        )
