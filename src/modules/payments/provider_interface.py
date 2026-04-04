"""Abstract PaymentProvider interface.

Defines the contract that payment providers must implement.
Currently only RevenueCatProvider uses this interface.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
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
    event_id: Optional[str] = None
    provider_subscription_id: Optional[str] = None
    provider_transaction_id: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    user_id: str = ''
    period_end: Optional[datetime] = None  # datetime when subscription period ends
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

    Requirement 10.6: PaymentProvider interface with createSubscription,
    verifyWebhook, cancelSubscription, and refund methods.
    """

    @abstractmethod
    async def create_subscription(
        self, params: CreateSubscriptionParams
    ) -> ProviderSubscription:
        """Create a subscription with the payment provider."""
        ...

    @abstractmethod
    async def verify_webhook(
        self, payload: bytes, signature: str
    ) -> WebhookEvent:
        """Verify webhook signature and parse the event."""
        ...

    @abstractmethod
    async def cancel_subscription(
        self, provider_subscription_id: str
    ) -> None:
        """Cancel a subscription via the provider's API."""
        ...

    @abstractmethod
    async def refund(
        self,
        provider_transaction_id: str,
        amount: Optional[float] = None,
    ) -> RefundResult:
        """Request a refund via the provider's API."""
        ...
