"""Social module SQLAlchemy models.

Tables: follows, feed_events, reactions, leaderboard_entries, shared_templates.
"""

import secrets
import uuid
from datetime import date
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.shared.base_model import Base


# ---------------------------------------------------------------------------
# Composite-PK tables: override Base.id (not needed as PK here)
# ---------------------------------------------------------------------------


class Follow(Base):
    """User follow relationships (composite PK on follower + following)."""

    __tablename__ = "follows"

    # Override inherited Base.id — not used as PK, but keep server_default for safety
    id: Mapped[Optional[uuid.UUID]] = mapped_column(  # type: ignore[assignment]
        primary_key=False, default=uuid.uuid4, nullable=True
    )

    follower_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    following_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )

    __table_args__ = (
        CheckConstraint("follower_id != following_id", name="no_self_follow"),
        Index("idx_follows_following", "following_id"),
    )


class FeedEvent(Base):
    """Activity feed events (workout, pr, streak, achievement)."""

    __tablename__ = "feed_events"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(20), nullable=False)
    ref_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    metadata_: Mapped[Optional[dict]] = mapped_column(
        "metadata", JSONB, nullable=True, server_default=text("'{}'::jsonb")
    )

    reactions: Mapped[list["Reaction"]] = relationship(
        back_populates="feed_event", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("idx_feed_user_time", "user_id", "created_at"),)


class Reaction(Base):
    """Emoji reactions on feed events (composite PK on user + event)."""

    __tablename__ = "reactions"

    # Override inherited Base.id — not used as PK, but keep default for safety
    id: Mapped[Optional[uuid.UUID]] = mapped_column(  # type: ignore[assignment]
        primary_key=False, default=uuid.uuid4, nullable=True
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    feed_event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("feed_events.id", ondelete="CASCADE"), primary_key=True
    )
    emoji: Mapped[str] = mapped_column(String(10), default="💪")

    feed_event: Mapped["FeedEvent"] = relationship(back_populates="reactions")


class LeaderboardEntry(Base):
    """Weekly/monthly leaderboard snapshots."""

    __tablename__ = "leaderboard_entries"

    board_type: Mapped[str] = mapped_column(String(20), nullable=False)
    period_start: Mapped[date] = mapped_column(nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    score: Mapped[float] = mapped_column(Numeric, nullable=False)
    rank: Mapped[Optional[int]] = mapped_column(nullable=True)

    __table_args__ = (
        UniqueConstraint("board_type", "period_start", "user_id", name="uq_leaderboard_entry"),
        Index("idx_lb_board_period_rank", "board_type", "period_start", "rank"),
    )


class SharedTemplate(Base):
    """Shareable workout template links."""

    __tablename__ = "shared_templates"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    template_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workout_templates.id", ondelete="CASCADE"), nullable=False
    )
    share_code: Mapped[str] = mapped_column(
        String(12), unique=True, nullable=False, default=lambda: secrets.token_urlsafe(9)
    )
    copy_count: Mapped[int] = mapped_column(default=0)

    __table_args__ = (
        Index("idx_shared_templates_owner", "owner_id"),
        Index("idx_shared_templates_template", "template_id"),
    )
