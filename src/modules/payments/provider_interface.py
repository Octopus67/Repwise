"""Abstract PaymentProvider interface and region-based routing.

Defines the contract that all payment providers (Stripe, Razorpay, PayPal)
must implement, plus the PROVIDER_MAP for region-based provider selection.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class CreateSubscriptionParams:
    """Parameters for creating a subscription with a payment provider."""

    customer_email: str
    plan_id: str
    currency: str
    region: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ProviderSubscription:
    """Result from a successful subscription creation."""

    provider_subscription_id: str
    provider_customer_id: str
    status: str
    current_period_end: Optional[str] = None


@dataclass
class WebhookEvent:
    """Parsed webhook event from a payment provider."""

    event_type: str
    provider_subscription_id: Optional[str] = None
    provider_transaction_id: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class RefundResult:
    """Result from a refund request."""

    provider_transaction_id: str
    amount: float
    currency: str
    status: str


class PaymentProvider(ABC):
    """Abstract interface for payment providers.

    All payment providers (Stripe, Razorpay, PayPal) must implement these
    four methods. This abstraction allows the platform to swap or add
    providers without changing the core payment service logic.

    Requirement 10.6: PaymentProvider interface with createSubscription,
    verifyWebhook, cancelSubscription, and refund methods.
    """

    @abstractmethod
    async def create_subscription(
        self, params: CreateSubscriptionParams
    ) -> ProviderSubscription:
        """Create a subscription with the payment provider.

        Requirement 10.1: Delegate to the appropriate provider based on region.
        """
        ...

    @abstractmethod
    async def verify_webhook(
        self, payload: bytes, signature: str
    ) -> WebhookEvent:
        """Verify webhook signature and parse the event.

        Requirement 10.3: Verify the webhook signature before processing.
        Requirement 10.8: Reject and log if signature verification fails.
        """
        ...

    @abstractmethod
    async def cancel_subscription(
        self, provider_subscription_id: str
    ) -> None:
        """Cancel a subscription via the provider's API.

        Requirement 10.4: Invoke the provider's cancellation API.
        """
        ...

    @abstractmethod
    async def refund(
        self,
        provider_transaction_id: str,
        amount: Optional[float] = None,
    ) -> RefundResult:
        """Request a refund via the provider's API.

        Requirement 10.5: Invoke the provider's refund API.
        """
        ...


# ---------------------------------------------------------------------------
# Region-based provider routing
# ---------------------------------------------------------------------------

from src.modules.payments.stripe_provider import StripeProvider  # noqa: E402
from src.modules.payments.razorpay_provider import RazorpayProvider  # noqa: E402

PROVIDER_MAP: dict[str, type[PaymentProvider]] = {
    "US": StripeProvider,
    "IN": RazorpayProvider,
}


def get_provider_for_region(region: str) -> PaymentProvider:
    """Return an instantiated PaymentProvider for the given region.

    Requirement 10.1: Route to the correct provider based on region.

    Raises ValueError if the region is not supported.
    """
    provider_cls = PROVIDER_MAP.get(region)
    if provider_cls is None:
        raise ValueError(f"No payment provider configured for region: {region}")
    return provider_cls()
