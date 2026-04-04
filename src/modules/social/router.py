"""Social routes — follows, feed, reactions, leaderboard, template sharing."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.social.schemas import (
    FeedEventResponse,
    FeedPageResponse,
    FollowResponse,
    LeaderboardEntryEnriched,
    LeaderboardPageResponse,
    LeaderboardResponse,
    ReactionCreate,
    ReactionResponse,
    SharedTemplateResponse,
)
from src.modules.social.service import SocialService

router = APIRouter()


def _get_social_service(db: AsyncSession = Depends(get_db)) -> SocialService:
    return SocialService(db)


# ── Follows ───────────────────────────────────────────────────────────────


@router.post("/follow/{user_id}", response_model=FollowResponse, status_code=201)
async def follow_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: SocialService = Depends(_get_social_service),
) -> FollowResponse:
    """Follow a user."""
    follow = await service.follow_user(current_user.id, user_id)
    return FollowResponse.model_validate(follow)


@router.delete("/follow/{user_id}", status_code=204, response_model=None)
async def unfollow_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: SocialService = Depends(_get_social_service),
) -> None:
    """Unfollow a user."""
    await service.unfollow_user(current_user.id, user_id)


@router.get("/followers", response_model=list[FollowResponse])
async def get_followers(
    current_user: User = Depends(get_current_user),
    service: SocialService = Depends(_get_social_service),
    cursor: Optional[datetime] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[FollowResponse]:
    """Get paginated followers list."""
    follows = await service.get_followers(current_user.id, cursor, limit)
    return [FollowResponse.model_validate(f) for f in follows]


@router.get("/following", response_model=list[FollowResponse])
async def get_following(
    current_user: User = Depends(get_current_user),
    service: SocialService = Depends(_get_social_service),
    cursor: Optional[datetime] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[FollowResponse]:
    """Get paginated following list."""
    follows = await service.get_following(current_user.id, cursor, limit)
    return [FollowResponse.model_validate(f) for f in follows]


# ── Feed ──────────────────────────────────────────────────────────────────


@router.get("/feed", response_model=FeedPageResponse)
async def get_feed(
    current_user: User = Depends(get_current_user),
    service: SocialService = Depends(_get_social_service),
    cursor_time: Optional[datetime] = Query(default=None),
    cursor_id: Optional[uuid.UUID] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> FeedPageResponse:
    """Get activity feed from followed users (fan-out-on-read)."""
    events = await service.get_feed(current_user.id, cursor_time, cursor_id, limit)
    items = [FeedEventResponse.model_validate(e) for e in events]
    # Build next_cursor from last event if page is full
    next_cursor = None
    if items and len(items) == limit:
        last = items[-1]
        next_cursor = f"{last.created_at.isoformat()}|{last.id}"
    return FeedPageResponse(events=items, next_cursor=next_cursor)


# ── Reactions ─────────────────────────────────────────────────────────────


@router.post("/feed/{event_id}/reactions", response_model=ReactionResponse, status_code=201)
async def add_reaction(
    event_id: uuid.UUID,
    data: ReactionCreate,
    current_user: User = Depends(get_current_user),
    service: SocialService = Depends(_get_social_service),
) -> ReactionResponse:
    """Add or update a reaction on a feed event."""
    reaction = await service.add_reaction(current_user.id, event_id, data.emoji)
    return ReactionResponse.model_validate(reaction)


@router.delete("/feed/{event_id}/reactions", status_code=204, response_model=None)
async def remove_reaction(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: SocialService = Depends(_get_social_service),
) -> None:
    """Remove your reaction from a feed event."""
    await service.remove_reaction(current_user.id, event_id)


# ── Leaderboard ───────────────────────────────────────────────────────────


@router.get("/leaderboard/{board_type}", response_model=LeaderboardPageResponse)
async def get_leaderboard(
    board_type: Literal["weekly_volume", "streak", "exercise_1rm"],
    current_user: User = Depends(get_current_user),
    service: SocialService = Depends(_get_social_service),
    period_start: date = Query(...),
    limit: int = Query(default=50, ge=1, le=100),
) -> LeaderboardPageResponse:
    """Get leaderboard entries enriched with user data (Issue #10)."""
    entries = await service.get_leaderboard_enriched(board_type, period_start, limit)
    return LeaderboardPageResponse(entries=entries)


# ── Template Sharing ──────────────────────────────────────────────────────


@router.post("/templates/{template_id}/share", response_model=SharedTemplateResponse, status_code=201)
async def share_template(
    template_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: SocialService = Depends(_get_social_service),
) -> SharedTemplateResponse:
    """Create a shareable link for a workout template."""
    shared = await service.share_template(current_user.id, template_id)
    return SharedTemplateResponse.model_validate(shared)


@router.get("/shared/{share_code}", response_model=SharedTemplateResponse)
async def get_shared_template(
    share_code: str,
    db: AsyncSession = Depends(get_db),
) -> SharedTemplateResponse:
    """Get shared template details (public, no auth required)."""
    service = SocialService(db)
    shared = await service.get_shared_template(share_code)
    return SharedTemplateResponse.model_validate(shared)


@router.post("/shared/{share_code}/copy", status_code=201)
async def copy_shared_template(
    share_code: str,
    current_user: User = Depends(get_current_user),
    service: SocialService = Depends(_get_social_service),
) -> dict:
    """Copy a shared template to your account."""
    template = await service.copy_shared_template(current_user.id, share_code)
    return {"id": str(template.id), "name": template.name, "message": "Template copied successfully"}
