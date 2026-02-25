"""Notification routes for device token management and preferences.

POST   /register-device          — Register a device push token (JWT required)
DELETE /register-device/{token_id} — Unregister a device push token (JWT required)
GET    /preferences              — Get notification preferences (JWT required)
PATCH  /preferences              — Update notification preferences (JWT required)
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.notifications.schemas import (
    DeviceTokenCreate,
    DeviceTokenResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
)
from src.modules.notifications.service import NotificationService

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> NotificationService:
    return NotificationService(db)


@router.post("/register-device", response_model=DeviceTokenResponse, status_code=201)
async def register_device(
    data: DeviceTokenCreate,
    user: User = Depends(get_current_user),
    service: NotificationService = Depends(_get_service),
) -> DeviceTokenResponse:
    """Register a device push token for the authenticated user."""
    token = await service.register_device(user_id=user.id, data=data)
    return DeviceTokenResponse.model_validate(token)


@router.delete("/register-device/{token_id}", status_code=204)
async def unregister_device(
    token_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: NotificationService = Depends(_get_service),
) -> Response:
    """Unregister a device push token for the authenticated user."""
    await service.unregister_device(user_id=user.id, token_id=token_id)
    return Response(status_code=204)


@router.get("/preferences", response_model=NotificationPreferenceResponse)
async def get_preferences(
    user: User = Depends(get_current_user),
    service: NotificationService = Depends(_get_service),
) -> NotificationPreferenceResponse:
    """Get notification preferences for the authenticated user."""
    prefs = await service.get_preferences(user_id=user.id)
    return NotificationPreferenceResponse.model_validate(prefs)


@router.patch("/preferences", response_model=NotificationPreferenceResponse)
async def update_preferences(
    data: NotificationPreferenceUpdate,
    user: User = Depends(get_current_user),
    service: NotificationService = Depends(_get_service),
) -> NotificationPreferenceResponse:
    """Update notification preferences for the authenticated user."""
    prefs = await service.update_preferences(user_id=user.id, data=data)
    return NotificationPreferenceResponse.model_validate(prefs)
