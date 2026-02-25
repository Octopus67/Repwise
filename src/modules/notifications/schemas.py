"""Pydantic schemas for the notifications module."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DeviceTokenCreate(BaseModel):
    """Request body for registering a device push token."""

    platform: str = Field(..., pattern=r"^(ios|android)$")
    token: str = Field(..., min_length=1, max_length=500)


class DeviceTokenResponse(BaseModel):
    """Response body for a registered device token."""

    id: uuid.UUID
    user_id: uuid.UUID
    platform: str
    token: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationPreferenceResponse(BaseModel):
    """Response body for notification preferences."""

    push_enabled: bool
    coaching_reminders: bool
    subscription_alerts: bool

    model_config = {"from_attributes": True}


class NotificationPreferenceUpdate(BaseModel):
    """Request body for updating notification preferences (partial)."""

    push_enabled: Optional[bool] = None
    coaching_reminders: Optional[bool] = None
    subscription_alerts: Optional[bool] = None
