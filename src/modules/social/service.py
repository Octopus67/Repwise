"""Social service — follows, feed, reactions, leaderboard, template sharing."""

from __future__ import annotations

import logging
import secrets
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import delete, select, tuple_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.modules.social.models import (
    FeedEvent,
    Follow,
    LeaderboardEntry,
    Reaction,
    SharedTemplate,
)
from src.modules.training.models import WorkoutTemplate
from src.modules.user.models import UserProfile
from src.shared.errors import ConflictError, NotFoundError

logger = logging.getLogger(__name__)


class SocialService:
    """Handles social features: follows, feed, reactions, leaderboard, sharing."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── Follows ───────────────────────────────────────────────────────────

    async def follow_user(self, follower_id: uuid.UUID, following_id: uuid.UUID) -> Follow:
        """Create a follow relationship."""
        if follower_id == following_id:
            raise ConflictError("Cannot follow yourself")

        existing = await self.session.get(Follow, (follower_id, following_id))
        if existing:
            raise ConflictError("Already following this user")

        follow = Follow(follower_id=follower_id, following_id=following_id)
        self.session.add(follow)
        await self.session.flush()
        return follow

    async def unfollow_user(self, follower_id: uuid.UUID, following_id: uuid.UUID) -> None:
        """Remove a follow relationship."""
        result = await self.session.execute(
            delete(Follow).where(
                Follow.follower_id == follower_id,
                Follow.following_id == following_id,
            )
        )
        if result.rowcount == 0:
            raise NotFoundError("Follow relationship not found")

    async def get_followers(
        self, user_id: uuid.UUID, cursor: Optional[datetime], limit: int = 20
    ) -> list[Follow]:
        """Paginated followers list (cursor = created_at)."""
        stmt = select(Follow).where(Follow.following_id == user_id)
        if cursor:
            stmt = stmt.where(Follow.created_at < cursor)
        stmt = stmt.order_by(Follow.created_at.desc()).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_following(
        self, user_id: uuid.UUID, cursor: Optional[datetime], limit: int = 20
    ) -> list[Follow]:
        """Paginated following list (cursor = created_at)."""
        stmt = select(Follow).where(Follow.follower_id == user_id)
        if cursor:
            stmt = stmt.where(Follow.created_at < cursor)
        stmt = stmt.order_by(Follow.created_at.desc()).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    # ── Feed (fan-out-on-read) ────────────────────────────────────────────

    async def get_feed(
        self,
        user_id: uuid.UUID,
        cursor_time: Optional[datetime],
        cursor_id: Optional[uuid.UUID],
        limit: int = 20,
    ) -> list[FeedEvent]:
        """Fan-out-on-read feed: join follows → feed_events with composite cursor."""
        # Get IDs of users this person follows
        following_sub = select(Follow.following_id).where(Follow.follower_id == user_id)

        stmt = select(FeedEvent).where(FeedEvent.user_id.in_(following_sub)).options(selectinload(FeedEvent.reactions))

        if cursor_time and cursor_id:
            stmt = stmt.where(
                tuple_(FeedEvent.created_at, FeedEvent.id) < (cursor_time, cursor_id)
            )

        stmt = stmt.order_by(
            FeedEvent.created_at.desc(), FeedEvent.id.desc()
        ).limit(limit)

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    # ── Reactions ─────────────────────────────────────────────────────────

    async def add_reaction(
        self, user_id: uuid.UUID, feed_event_id: uuid.UUID, emoji: str = "💪"
    ) -> Reaction:
        """Upsert a reaction on a feed event."""
        existing = await self.session.get(Reaction, (user_id, feed_event_id))
        if existing:
            existing.emoji = emoji
            await self.session.flush()
            return existing

        reaction = Reaction(user_id=user_id, feed_event_id=feed_event_id, emoji=emoji)
        self.session.add(reaction)
        await self.session.flush()
        return reaction

    async def remove_reaction(self, user_id: uuid.UUID, feed_event_id: uuid.UUID) -> None:
        """Delete a reaction."""
        result = await self.session.execute(
            delete(Reaction).where(
                Reaction.user_id == user_id,
                Reaction.feed_event_id == feed_event_id,
            )
        )
        if result.rowcount == 0:
            raise NotFoundError("Reaction not found")

    # ── Leaderboard ───────────────────────────────────────────────────────

    async def get_leaderboard(
        self, board_type: str, period_start: date, limit: int = 50
    ) -> list[LeaderboardEntry]:
        """Fetch leaderboard entries sorted by rank."""
        stmt = (
            select(LeaderboardEntry)
            .where(
                LeaderboardEntry.board_type == board_type,
                LeaderboardEntry.period_start == period_start,
            )
            .order_by(LeaderboardEntry.rank.asc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    _BOARD_UNITS = {"weekly_volume": "kg", "streak": "days", "exercise_1rm": "kg"}

    async def get_leaderboard_enriched(
        self, board_type: str, period_start: date, limit: int = 50
    ) -> list[dict]:
        """Fetch leaderboard entries enriched with user profile data."""
        entries = await self.get_leaderboard(board_type, period_start, limit)
        if not entries:
            return []
        user_ids = [e.user_id for e in entries]
        stmt = select(UserProfile).where(UserProfile.user_id.in_(user_ids))
        result = await self.session.execute(stmt)
        profiles = {p.user_id: p for p in result.scalars().all()}
        unit = self._BOARD_UNITS.get(board_type, "")
        enriched = []
        for e in entries:
            p = profiles.get(e.user_id)
            enriched.append({
                "rank": e.rank,
                "user": {
                    "id": str(e.user_id),
                    "display_name": p.display_name if p and p.display_name else "Anonymous",
                    "avatar_url": p.avatar_url if p else None,
                },
                "score": float(e.score),
                "unit": unit,
            })
        return enriched

    # ── Template Sharing ──────────────────────────────────────────────────

    async def share_template(
        self, owner_id: uuid.UUID, template_id: uuid.UUID
    ) -> SharedTemplate:
        """Create a shareable link for a workout template."""
        # Verify template exists and belongs to user
        stmt = select(WorkoutTemplate).where(
            WorkoutTemplate.id == template_id,
            WorkoutTemplate.user_id == owner_id,
        )
        result = await self.session.execute(stmt)
        if not result.scalar_one_or_none():
            raise NotFoundError("Template not found")

        shared = SharedTemplate(
            owner_id=owner_id,
            template_id=template_id,
            share_code=secrets.token_urlsafe(9),
        )
        for attempt in range(3):
            try:
                self.session.add(shared)
                await self.session.flush()
                return shared
            except IntegrityError:
                await self.session.rollback()
                shared = SharedTemplate(
                    owner_id=owner_id,
                    template_id=template_id,
                    share_code=secrets.token_urlsafe(9),
                )
        raise ConflictError("Failed to generate unique share code")

    async def get_shared_template(self, share_code: str) -> SharedTemplate:
        """Fetch a shared template by share_code (public)."""
        stmt = select(SharedTemplate).where(SharedTemplate.share_code == share_code)
        result = await self.session.execute(stmt)
        shared = result.scalar_one_or_none()
        if not shared:
            raise NotFoundError("Shared template not found")
        return shared

    async def copy_shared_template(
        self, user_id: uuid.UUID, share_code: str
    ) -> WorkoutTemplate:
        """Copy a shared template to the user's account, increment copy_count."""
        shared = await self.get_shared_template(share_code)

        # Fetch the original template
        stmt = select(WorkoutTemplate).where(WorkoutTemplate.id == shared.template_id)
        result = await self.session.execute(stmt)
        original = result.scalar_one_or_none()
        if not original:
            raise NotFoundError("Original template no longer exists")

        # Copy to user
        copy = WorkoutTemplate(
            user_id=user_id,
            name=f"{original.name} (shared)",
            description=original.description,
            exercises=original.exercises,
            metadata_=original.metadata_,
        )
        self.session.add(copy)

        shared.copy_count += 1
        await self.session.flush()
        return copy

    # ── Feed Event Creation ───────────────────────────────────────────────

    async def create_feed_event(
        self,
        user_id: uuid.UUID,
        event_type: str,
        ref_id: uuid.UUID,
        metadata: Optional[dict] = None,
    ) -> FeedEvent:
        """Create a feed event entry."""
        event = FeedEvent(
            user_id=user_id,
            event_type=event_type,
            ref_id=ref_id,
            metadata_=metadata,
        )
        self.session.add(event)
        await self.session.flush()
        return event
