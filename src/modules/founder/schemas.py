"""Pydantic schemas for the founder module."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator

from src.shared.validators import validate_json_size


class FounderContentResponse(BaseModel):
    """Response schema for founder content."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    section_key: str
    locale: str
    content: dict[str, Any]
    version: int
    updated_at: Optional[datetime] = None


class FounderContentUpdate(BaseModel):
    """Request schema for updating founder content (admin only)."""

    section_key: str = Field(..., min_length=1, max_length=100)
    locale: str = Field(default="en", max_length=10)
    content: dict[str, Any] = Field(..., description="JSONB content payload")

    @field_validator("content")
    @classmethod
    def validate_content_size(cls, v: dict[str, Any]) -> dict[str, Any]:
        return validate_json_size(v)
