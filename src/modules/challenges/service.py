"""Weekly challenges service — generate, fetch, and update challenges."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.challenges.models import WeeklyChallenge

# Static challenge templates
CHALLENGE_TEMPLATES = [
    {
        "challenge_type": "training_volume",
        "title": "Volume Crusher",
        "description": "Log at least 50,000 kg total training volume this week",
        "target_value": 50000,
    },
    {
        "challenge_type": "workout_count",
        "title": "Consistency King",
        "description": "Complete at least 4 workouts this week",
        "target_value": 4,
    },
    {
        "challenge_type": "nutrition_compliance",
        "title": "Macro Master",
        "description": "Hit your protein target on 5 days this week",
        "target_value": 5,
    },
]


def _current_week_range() -> tuple[date, date]:
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


async def generate_weekly_challenges(
    session: AsyncSession, user_id: uuid.UUID
) -> list[WeeklyChallenge]:
    """Generate 3 challenges for the current week if none exist."""
    week_start, week_end = _current_week_range()

    existing = (
        await session.execute(
            select(WeeklyChallenge).where(
                WeeklyChallenge.user_id == user_id,
                WeeklyChallenge.week_start == week_start,
            )
        )
    ).scalars().all()

    if existing:
        return list(existing)

    challenges = []
    for tmpl in CHALLENGE_TEMPLATES:
        ch = WeeklyChallenge(
            user_id=user_id,
            challenge_type=tmpl["challenge_type"],
            title=tmpl["title"],
            description=tmpl["description"],
            target_value=tmpl["target_value"],
            current_value=0,
            week_start=week_start,
            week_end=week_end,
        )
        session.add(ch)
        challenges.append(ch)

    await session.flush()
    return challenges


async def get_current_challenges(
    session: AsyncSession, user_id: uuid.UUID
) -> list[WeeklyChallenge]:
    """Return this week's challenges."""
    week_start, _ = _current_week_range()
    result = await session.execute(
        select(WeeklyChallenge).where(
            WeeklyChallenge.user_id == user_id,
            WeeklyChallenge.week_start == week_start,
        )
    )
    return list(result.scalars().all())


async def update_progress(
    session: AsyncSession,
    user_id: uuid.UUID,
    challenge_id: uuid.UUID,
    value: int,
) -> WeeklyChallenge:
    """Update current_value and mark completed if target reached."""
    result = await session.execute(
        select(WeeklyChallenge).where(
            WeeklyChallenge.id == challenge_id,
            WeeklyChallenge.user_id == user_id,
        )
    )
    challenge = result.scalar_one_or_none()
    if challenge is None:
        from src.shared.errors import NotFoundError
        raise NotFoundError("Challenge not found")

    challenge.current_value = value
    if value >= challenge.target_value and not challenge.completed:
        challenge.completed = True
        challenge.completed_at = datetime.utcnow()

    await session.flush()
    return challenge


async def update_challenge_progress_from_session(
    session: AsyncSession, user_id: uuid.UUID, exercises: list
) -> None:
    """Auto-update challenge progress after a workout."""
    challenges = await get_current_challenges(session, user_id)
    if not challenges:
        return
    for ch in challenges:
        if ch.completed:
            continue
        if ch.challenge_type == "workout_count":
            ch.current_value += 1
        elif ch.challenge_type == "training_volume":
            vol = sum(
                (s.get("weight_kg", 0) or 0) * (s.get("reps", 0) or 0)
                for ex in (exercises or [])
                for s in ex.get("sets", [])
            )
            ch.current_value += int(vol)
        if ch.current_value >= ch.target_value and not ch.completed:
            ch.completed = True
            ch.completed_at = datetime.utcnow()
    await session.flush()
