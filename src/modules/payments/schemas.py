"""Pydantic schemas for payment and subscription endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CancelRequest(BaseModel):
    """Request body for cancelling a subscription."""

    subscription_id: uuid.UUID


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


class WebhookResponse(BaseModel):
    """Response returned after processing a webhook."""

    status: str = "ok"
    event_type: Optional[str] = None

