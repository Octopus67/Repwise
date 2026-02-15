"""Pydantic schemas for payment and subscription endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class SubscribeRequest(BaseModel):
    """Request body for initiating a subscription."""

    plan_id: str = Field(..., min_length=1, max_length=100)
    region: str = Field(..., min_length=2, max_length=10)
    currency: str = Field(..., min_length=3, max_length=3)


class CancelRequest(BaseModel):
    """Request body for cancelling a subscription."""

    subscription_id: uuid.UUID


class RefundRequest(BaseModel):
    """Request body for requesting a refund."""

    subscription_id: uuid.UUID
    amount: Optional[float] = Field(default=None, ge=0)


class SubscriptionResponse(BaseModel):
    """Response model for subscription data."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    user_id: uuid.UUID
    provider_name: str
    provider_subscription_id: Optional[str] = None
    provider_customer_id: Optional[str] = None
    plan_id: Optional[str] = None
    status: str
    currency: str
    region: str
    current_period_end: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class PaymentTransactionResponse(BaseModel):
    """Response model for payment transaction data."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    subscription_id: uuid.UUID
    user_id: uuid.UUID
    provider_name: str
    provider_transaction_id: Optional[str] = None
    amount: float
    currency: str
    type: str
    status: str
    metadata: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None


class WebhookResponse(BaseModel):
    """Response returned after processing a webhook."""

    status: str = "ok"
    event_type: Optional[str] = None
