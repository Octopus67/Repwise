"""SQLAlchemy models for subscriptions and payment transactions."""

from __future__ import annotations
from typing import Optional

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Index, String, text
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

    user_id: Mapped[uuid.UUID] = mapped_column(index=True)
    provider_name: Mapped[str] = mapped_column(String(50))
    provider_subscription_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    provider_customer_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    plan_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="free")
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    region: Mapped[str] = mapped_column(String(10), default="US")
    current_period_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        Index("ix_subscriptions_user_status", "user_id", "status"),
    )


class PaymentTransaction(Base):
    """Individual payment transaction linked to a subscription.

    Records charges and refunds for audit and reconciliation.

    Requirement 10.5: Record transactions in PaymentTransactions.
    """

    __tablename__ = "payment_transactions"

    subscription_id: Mapped[uuid.UUID] = mapped_column(index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(index=True)
    provider_name: Mapped[str] = mapped_column(String(50))
    provider_transaction_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10))
    type: Mapped[str] = mapped_column(String(20))  # charge | refund
    status: Mapped[str] = mapped_column(String(20))  # pending | succeeded | failed
    metadata_: Mapped[Optional[dict]] = mapped_column(
        "metadata",
        JSONB, nullable=True, server_default=text("'{}'::jsonb"),
    )
