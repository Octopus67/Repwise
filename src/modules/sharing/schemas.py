"""Sharing schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ShareEventCreate(BaseModel):
    session_id: Optional[UUID] = None
    share_type: str = "workout"
    platform: Optional[str] = None


class ShareEventResponse(BaseModel):
    id: UUID
    user_id: UUID
    session_id: Optional[UUID]
    share_type: str
    platform: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
