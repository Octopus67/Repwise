"""Pydantic schemas for coaching request/response models."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class CoachingRequestCreate(BaseModel):
    """Payload for submitting a coaching request (Requirement 12.1)."""

    goals: str = Field(..., min_length=1, max_length=2000)
    progress_data: Optional[dict[str, Any]] = None


class CoachingRequestResponse(BaseModel):
    """Coaching request returned by the API."""

    id: uuid.UUID
    user_id: uuid.UUID
    status: str
    goals: str
    progress_data: Optional[dict[str, Any]] = None
    document_urls: Optional[list[str]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CoachingRequestApprove(BaseModel):
    """Payload for approving a coaching request (admin)."""

    coach_id: uuid.UUID
    scheduled_at: Optional[datetime] = None


class CoachingSessionResponse(BaseModel):
    """Coaching session returned by the API."""

    id: uuid.UUID
    request_id: uuid.UUID
    coach_id: uuid.UUID
    status: str
    notes: Optional[str] = None
    document_urls: Optional[list[str]] = None
    scheduled_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SessionCompleteRequest(BaseModel):
    """Payload for completing a coaching session."""

    notes: Optional[str] = Field(default=None, max_length=5000)


class DocumentUploadRequest(BaseModel):
    """Payload for uploading a document URL to a session."""

    document_url: str = Field(..., min_length=1, max_length=2048)


class CoachProfileCreate(BaseModel):
    """Payload for creating a coach profile."""

    bio: Optional[str] = Field(default=None, max_length=2000)
    specializations: Optional[list[str]] = None


class CoachProfileResponse(BaseModel):
    """Coach profile returned by the API."""

    id: uuid.UUID
    user_id: uuid.UUID
    bio: Optional[str] = None
    specializations: Optional[dict[str, Any]] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
