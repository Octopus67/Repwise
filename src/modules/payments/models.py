"""SQLAlchemy models for subscriptions and payment transactions."""

from __future__ import annotations
from typing import Optional

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.base_model import Base
from src.shared.soft_delete import SoftDeleteMixin


class Subscription(Base, SoftDeleteMixin):
    """A user's subscription record, decoupled from the payment provider.

    Stores provider details alongside platform-level status so the
    subscription state machine operates independently of any single
    provider's API.

    Requirement 10.2: Subscription record decoupled from provider.
    """

    __tablename__ = "subscriptions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    provider_name: Mapped[str] = mapped_column(String(50))
    provider_subscription_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    provider_customer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    plan_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="free")
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    region: Mapped[str] = mapped_column(String(10), default="US")
    current_period_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_trial: Mapped[bool] = mapped_column(default=False, server_default="false")

    __table_args__ = (
        Index("ix_subscriptions_user_status", "user_id", "status"),
        # Audit fix 8.2 — prevent duplicate subscriptions per provider
        UniqueConstraint(
            "user_id", "provider_subscription_id", name="uq_subscription_user_provider"
        ),
        # Audit fix 8.8 — only one active/trialing subscription per user
        Index(
            "uq_active_subscription",
            "user_id",
            unique=True,
            postgresql_where=text("status IN ('active', 'trialing') AND deleted_at IS NULL"),
        ),
    )


class PaymentTransaction(Base):
    """Individual payment transaction linked to a subscription.

    Records charges and refunds for audit and reconciliation.

    Requirement 10.5: Record transactions in PaymentTransactions.
    """

    __tablename__ = "payment_transactions"

    subscription_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    provider_name: Mapped[str] = mapped_column(String(50))
    provider_transaction_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10))
    type: Mapped[str] = mapped_column(String(20))  # charge | refund
    status: Mapped[str] = mapped_column(String(20))  # pending | succeeded | failed
    metadata_: Mapped[Optional[dict]] = mapped_column(
        "metadata",
        JSONB,
        nullable=True,
        server_default=text("'{}'::jsonb"),
    )

    # Audit fix 8.5 — composite index for user transaction history queries
    __table_args__ = (Index("ix_payment_transactions_user_created", "user_id", "created_at"),)


class WebhookEventLog(Base):
    """Tracks processed webhook events for idempotency."""

    __tablename__ = "webhook_event_logs"

    provider_name: Mapped[str] = mapped_column(String(50))
    event_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    event_type: Mapped[str] = mapped_column(String(100))
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )
