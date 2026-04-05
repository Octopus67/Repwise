"""RevenueCat payment provider implementation.

Implements the PaymentProvider interface for RevenueCat (iOS IAP / Google Play).
RevenueCat manages subscriptions client-side via its SDK; the backend handles
webhook events and entitlement verification via the REST API.

Subscription creation and cancellation happen on-device through the stores,
so those methods raise NotImplementedError.
"""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional

import hmac
import json
import logging

import httpx

from src.config.settings import settings
from src.modules.payments.provider_interface import (
    CreateSubscriptionParams,
    PaymentProvider,
    ProviderSubscription,
    RefundResult,
    WebhookEvent,
)
from src.shared.errors import ProviderError, UnprocessableError
from src.utils.retry import async_retry

logger = logging.getLogger(__name__)

# Map RevenueCat event types to normalized event names
REVENUECAT_EVENT_MAP: dict[str, str] = {
    "INITIAL_PURCHASE": "subscription.activated",
    "RENEWAL": "invoice.paid",
    "CANCELLATION": "subscription.cancelled",
    "EXPIRATION": "subscription.expired",
    "BILLING_ISSUE_DETECTED": "invoice.payment_failed",
    "SUBSCRIBER_ALIAS": "customer.alias_updated",
    "REFUND": "payment.refunded",
    "PRODUCT_CHANGE": "subscription.product_changed",
}


class RevenueCatProvider(PaymentProvider):
    """RevenueCat payment provider for iOS IAP and Google Play Billing.

    Webhook verification uses Bearer token auth (not HMAC signatures).
    Subscriptions are managed client-side; backend only processes webhooks
    and verifies entitlements.
    """

    def __init__(self) -> None:
        self.api_key = settings.REVENUECAT_API_KEY
        self.webhook_auth_key = settings.REVENUECAT_WEBHOOK_AUTH_KEY
        self.api_url = settings.REVENUECAT_API_URL

    async def create_subscription(
        self, params: CreateSubscriptionParams
    ) -> ProviderSubscription:
        """Not supported — RevenueCat subscriptions are created client-side via SDK."""
        raise NotImplementedError(
            "RevenueCat subscriptions are created client-side via the mobile SDK. "
            "Use the RevenueCat SDK in the iOS/Android app to initiate purchases."
        )

    async def verify_webhook(
        self, payload: bytes, signature: str
    ) -> WebhookEvent:
        """Verify RevenueCat webhook using Bearer token authorization.

        RevenueCat sends an Authorization header with a Bearer token that
        must match our configured webhook auth key.

        Requirement 10.3, 10.8: Verify auth before processing.
        """
        # signature param carries the Authorization header value
        expected = f"Bearer {self.webhook_auth_key}"
        if not signature or not hmac.compare_digest(signature, expected):
            raise UnprocessableError("Webhook authorization verification failed")

        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            raise UnprocessableError("Invalid webhook payload JSON")

        event_data = data.get("event", {})
        rc_event_type = event_data.get("type", "")
        normalized_type = REVENUECAT_EVENT_MAP.get(rc_event_type, rc_event_type.lower())

        # Extract period end from expiration timestamp
        expiration_ms = event_data.get("expiration_at_ms")
        period_end = datetime.fromtimestamp(expiration_ms / 1000, tz=timezone.utc) if expiration_ms else None

        return WebhookEvent(
            event_type=normalized_type,
            event_id=event_data.get("id"),
            provider_subscription_id=event_data.get("original_transaction_id", event_data.get("id", "")),
            provider_transaction_id=event_data.get("transaction_id"),
            user_id=event_data.get("app_user_id", ""),
            amount=event_data.get("price"),
            currency=event_data.get("currency"),
            period_end=period_end,
            metadata={
                "product_id": event_data.get("product_id"),
                "store": event_data.get("store"),
                "environment": event_data.get("environment"),
            },
        )

    async def cancel_subscription(
        self, provider_subscription_id: str
    ) -> None:
        """Not supported — RevenueCat cancellations happen through the app stores."""
        raise NotImplementedError(
            "RevenueCat subscriptions are cancelled through the app store (iOS/Android). "
            "Cancellation events are received via webhooks."
        )

    async def refund(
        self,
        provider_transaction_id: str,
        amount: Optional[float] = None,
    ) -> RefundResult:
        """Not supported — refunds are processed through the app stores."""
        raise NotImplementedError(
            "RevenueCat refunds are processed through the app store (iOS/Android). "
            "Refund events are received via webhooks."
        )

    @async_retry(
        max_retries=3,
        base_delay=1.0,
        retryable_exceptions=(httpx.ConnectError, httpx.TimeoutException),
    )
    async def verify_entitlement(self, user_id: str) -> bool:
        """Check if a user has an active entitlement via RevenueCat REST API.

        Calls GET /v1/subscribers/{user_id} and checks for active entitlements.
        """
        url = f"{self.api_url}/subscribers/{user_id}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, timeout=10.0)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error("RevenueCat API error for user %s: %s", user_id, exc)
            raise ProviderError(f"RevenueCat API error: {exc}") from exc

        data = response.json()
        entitlements = data.get("subscriber", {}).get("entitlements", {})

        # Check if any entitlement is currently active
        now = datetime.now(timezone.utc)
        for ent in entitlements.values():
            expires = ent.get("expires_date")
            if expires is None:
                # Lifetime entitlement
                return True
            try:
                exp_dt = datetime.fromisoformat(expires.replace("Z", "+00:00"))
                if exp_dt > now:
                    return True
            except (ValueError, TypeError):
                continue

        return False
