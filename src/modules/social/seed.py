"""Seed data for the social module — official bot accounts, feed events, leaderboard entries."""

from __future__ import annotations

import logging
import uuid
from datetime import date, timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.auth.models import User
from src.modules.social.models import FeedEvent, Follow, LeaderboardEntry
from src.shared.types import AuthProvider, UserRole

logger = logging.getLogger(__name__)

BOT_DOMAIN = "@repwise.bot"

# Official bot account definitions
OFFICIAL_ACCOUNTS = [
    {"email": "team@repwise.bot", "name": "Repwise Team"},
    {"email": "coach.alex@repwise.bot", "name": "Coach Alex"},
    {"email": "community@repwise.bot", "name": "Repwise Community"},
]

# Seed feed events: (bot email, event_type, metadata)
SEED_FEED_EVENTS = [
    ("coach.alex@repwise.bot", "workout", {"summary": "Push Day — 4 exercises, 45 min", "exercises": 4, "duration_min": 45}),
    ("team@repwise.bot", "share", {"summary": "Shared a new workout template: PPL Beginner"}),
    ("coach.alex@repwise.bot", "pr", {"summary": "New PR: Bench Press 100kg x 5", "exercise": "Bench Press", "weight_kg": 100, "reps": 5}),
    ("community@repwise.bot", "challenge", {"summary": "New challenge: 30-Day Consistency Streak"}),
    ("coach.alex@repwise.bot", "workout", {"summary": "Pull Day — 5 exercises, 50 min", "exercises": 5, "duration_min": 50}),
    ("team@repwise.bot", "tip", {"summary": "Tip: Track your RPE to auto-regulate volume over time"}),
    ("community@repwise.bot", "achievement", {"summary": "100 members hit a new PR this week!"}),
    ("coach.alex@repwise.bot", "post", {"content": "Recovery is where gains happen. Sleep 7-9 hours, eat enough protein, and don't skip rest days.", "post_type": "text"}),
    ("team@repwise.bot", "post", {"content": "New feature: You can now configure your rest timer duration in Settings. Compound and isolation exercises get separate timers.", "post_type": "text"}),
    ("community@repwise.bot", "post", {"content": "Weekly check-in: What muscle group are you focusing on this week? Drop your split below.", "post_type": "text"}),
    ("coach.alex@repwise.bot", "pr", {"summary": "New PR: Squat 140kg x 3", "exercise": "Squat", "weight_kg": 140, "reps": 3}),
    ("coach.alex@repwise.bot", "workout", {"summary": "Leg Day — 6 exercises, 55 min", "exercises": 6, "duration_min": 55}),
]


async def seed_social_data(session: AsyncSession) -> None:
    """Idempotent seed: create bot accounts, feed events, and leaderboard entries if missing."""
    # Check if bot accounts already exist
    stmt = select(func.count()).select_from(User).where(User.email.like(f"%{BOT_DOMAIN}"))
    count = (await session.execute(stmt)).scalar_one()
    if count >= len(OFFICIAL_ACCOUNTS):
        logger.info("Social seed data already exists (%d bot accounts), skipping", count)
        return

    # Create bot accounts
    bot_users: dict[str, User] = {}
    for acct in OFFICIAL_ACCOUNTS:
        existing = (await session.execute(
            select(User).where(User.email == acct["email"], User.deleted_at.is_(None))
        )).scalar_one_or_none()
        if existing:
            bot_users[acct["email"]] = existing
            continue
        user = User(
            email=acct["email"],
            hashed_password=None,
            auth_provider=AuthProvider.EMAIL,
            role=UserRole.USER,
            email_verified=True,
            metadata_={"display_name": acct["name"], "is_official_bot": True},
        )
        session.add(user)
        bot_users[acct["email"]] = user
    await session.flush()

    # Create seed feed events
    for email, event_type, metadata in SEED_FEED_EVENTS:
        bot = bot_users[email]
        event = FeedEvent(
            user_id=bot.id,
            event_type=event_type,
            ref_id=uuid.uuid4(),  # synthetic ref
            metadata_=metadata,
        )
        session.add(event)

    # Create seed leaderboard entries
    today = date.today()
    period_start = today - timedelta(days=today.weekday())  # Monday of current week
    for rank, (email, score) in enumerate(
        [("coach.alex@repwise.bot", 1250.0), ("team@repwise.bot", 980.0), ("community@repwise.bot", 870.0)],
        start=1,
    ):
        bot = bot_users[email]
        entry = LeaderboardEntry(
            board_type="weekly",
            period_start=period_start,
            user_id=bot.id,
            score=score,
            rank=rank,
        )
        session.add(entry)

    await session.commit()
    logger.info("Seeded %d official bot accounts, %d feed events, 3 leaderboard entries",
                len(OFFICIAL_ACCOUNTS), len(SEED_FEED_EVENTS))


async def get_official_bot_ids(session: AsyncSession) -> list[uuid.UUID]:
    """Return user IDs of all @repwise.bot accounts."""
    stmt = select(User.id).where(User.email.like(f"%{BOT_DOMAIN}"), User.deleted_at.is_(None))
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def auto_follow_official_accounts(session: AsyncSession, user_id: uuid.UUID) -> None:
    """Make a user follow all official bot accounts. Skips already-followed."""
    bot_ids = await get_official_bot_ids(session)
    for bot_id in bot_ids:
        if bot_id == user_id:
            continue
        existing = await session.get(Follow, (user_id, bot_id))
        if existing:
            continue
        session.add(Follow(follower_id=user_id, following_id=bot_id))
    await session.flush()
