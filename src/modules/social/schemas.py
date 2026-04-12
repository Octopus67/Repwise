"""Social module Pydantic request/response schemas."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator

from src.shared.sanitize import clean_text, strip_html


class FollowResponse(BaseModel):
    follower_id: uuid.UUID
    following_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class FeedEventResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    event_type: str
    ref_id: uuid.UUID
    metadata: Optional[dict[str, Any]] = None
    created_at: datetime
    reactions: list[ReactionResponse] = []

    model_config = {"from_attributes": True}


class PostCreate(BaseModel):
    """User-created social post."""

    content: str = Field(..., min_length=1, max_length=500)
    post_type: str = Field(default="text", pattern="^(text|progress|milestone)$")

    @field_validator("content")
    @classmethod
    def sanitize_content(cls, v: str) -> str:
        return clean_text(v)


class ReactionCreate(BaseModel):
    emoji: str = Field(default="💪", max_length=10)

    # Audit fix 2.4 — HTML sanitization
    @field_validator("emoji")
    @classmethod
    def sanitize_emoji(cls, v: str) -> str:
        return strip_html(v)


class ReactionResponse(BaseModel):
    user_id: uuid.UUID
    feed_event_id: uuid.UUID
    emoji: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LeaderboardResponse(BaseModel):
    id: uuid.UUID
    board_type: str
    period_start: date
    user_id: uuid.UUID
    score: float
    rank: Optional[int] = None

    model_config = {"from_attributes": True}


class SharedTemplateResponse(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    template_id: uuid.UUID
    share_code: str
    copy_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class FeedPageResponse(BaseModel):
    """Wrapped feed response matching frontend FeedPage contract (Issue #9)."""

    events: list[FeedEventResponse]
    next_cursor: Optional[str] = None


class LeaderboardEntryEnriched(BaseModel):
    """Enriched leaderboard entry with user data (Issue #10)."""

    rank: Optional[int] = None
    user: dict  # { id, display_name, avatar_url }
    score: float
    unit: str


class LeaderboardPageResponse(BaseModel):
    """Wrapped leaderboard response matching frontend contract (Issue #10)."""

    entries: list[LeaderboardEntryEnriched]


class ShareTemplateRequest(BaseModel):
    template_id: uuid.UUID


# Resolve forward reference
FeedEventResponse.model_rebuild()
