"""Payment and subscription routes.

POST /subscribe       — Initiate a subscription (JWT required)
POST /webhook/{provider} — Receive provider webhooks (public, no JWT)
POST /cancel          — Cancel a subscription (JWT required)
POST /refund          — Request a refund (JWT required)
GET  /status          — Get subscription status (JWT required)
"""

from __future__ import annotations
from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.payments.schemas import (
    CancelRequest,
    RefundRequest,
    SubscribeRequest,
    SubscriptionResponse,
    PaymentTransactionResponse,
    WebhookResponse,
)
from src.modules.payments.service import PaymentService

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> PaymentService:
    return PaymentService(db)


@router.post("/subscribe", response_model=SubscriptionResponse, status_code=201)
async def subscribe(
    data: SubscribeRequest,
    user: User = Depends(get_current_user),
    service: PaymentService = Depends(_get_service),
) -> SubscriptionResponse:
    """Initiate a subscription for the authenticated user."""
    subscription = await service.initiate_subscription(user_id=user.id, data=data)
    return SubscriptionResponse.model_validate(subscription)


@router.post("/webhook/{provider}", response_model=WebhookResponse)
async def webhook(
    provider: str,
    request: Request,
    service: PaymentService = Depends(_get_service),
) -> WebhookResponse:
    """Receive and process a webhook from a payment provider.

    This endpoint is public (no JWT required) but verifies the
    cryptographic signature from the provider.

    Requirement 10.3: Verify webhook signature before processing.
    """
    payload = await request.body()
    signature = request.headers.get("X-Webhook-Signature", "")

    event = await service.handle_webhook(
        provider_name=provider,
        payload=payload,
        signature=signature,
    )
    return WebhookResponse(status="ok", event_type=event.event_type)


@router.post("/cancel", response_model=SubscriptionResponse)
async def cancel(
    data: CancelRequest,
    user: User = Depends(get_current_user),
    service: PaymentService = Depends(_get_service),
) -> SubscriptionResponse:
    """Cancel the user's subscription."""
    subscription = await service.cancel_subscription(user_id=user.id, data=data)
    return SubscriptionResponse.model_validate(subscription)


@router.post("/refund", response_model=PaymentTransactionResponse, status_code=201)
async def refund(
    data: RefundRequest,
    user: User = Depends(get_current_user),
    service: PaymentService = Depends(_get_service),
) -> PaymentTransactionResponse:
    """Request a refund for a subscription."""
    transaction = await service.request_refund(user_id=user.id, data=data)
    return PaymentTransactionResponse.model_validate(transaction)


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
