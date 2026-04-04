"""Payment and subscription routes.

POST /webhook/revenuecat — Receive RevenueCat webhooks (public, Bearer token auth)
POST /cancel             — Cancel a subscription (JWT required)
GET  /status             — Get subscription status (JWT required)
"""

from __future__ import annotations
import logging

import sentry_sdk
from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.middleware.rate_limiter import check_user_endpoint_rate_limit
from src.modules.auth.models import User
from src.modules.payments.schemas import (
    CancelRequest,
    SubscriptionResponse,
    WebhookResponse,
)
from src.modules.payments.service import PaymentService

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> PaymentService:
    return PaymentService(db)


@router.post("/webhook/revenuecat", response_model=WebhookResponse)
async def webhook_revenuecat(
    request: Request,
    service: PaymentService = Depends(_get_service),
) -> WebhookResponse:
    """Receive and process a webhook from RevenueCat.

    This endpoint is public (no JWT required) but verifies the
    Bearer token from the Authorization header.

    Requirement 10.3: Verify webhook auth before processing.
    """
    sentry_sdk.set_tag('component', 'webhook')
    payload = await request.body()
    # RevenueCat uses Authorization: Bearer <key> instead of signature header
    authorization = request.headers.get("Authorization", "")

    event = await service.handle_webhook(
        payload=payload,
        signature=authorization,
    )
    return WebhookResponse(status="ok", event_type=event.event_type)


@router.post("/cancel", response_model=SubscriptionResponse)
async def cancel(
    data: CancelRequest,
    user: User = Depends(get_current_user),
    service: PaymentService = Depends(_get_service),
) -> SubscriptionResponse:
    """Cancel the user's subscription."""
    check_user_endpoint_rate_limit(str(user.id), "payments:cancel", 10, 60)
    subscription = await service.cancel_subscription(user_id=user.id, data=data)
    return SubscriptionResponse.model_validate(subscription)


@router.get("/status", response_model=Optional[SubscriptionResponse])
async def status(
    user: User = Depends(get_current_user),
    service: PaymentService = Depends(_get_service),
) -> Optional[SubscriptionResponse]:
    """Get the current subscription status for the authenticated user."""
    subscription = await service.get_subscription_status(user_id=user.id)
    if subscription is None:
        return None
    return SubscriptionResponse.model_validate(subscription)
