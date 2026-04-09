"""Refresh leaderboard job — weekly volume and streak boards.

Schedule: every 15 minutes via APScheduler or cron.
Usage:
    python -m src.jobs.refresh_leaderboards
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import defaultdict
from datetime import date, timedelta

import sentry_sdk
from sqlalchemy import select, delete
from sqlalchemy.exc import SQLAlchemyError

from src.config.database import async_session_factory
from src.config.redis import get_redis
from src.modules.social.models import LeaderboardEntry
from src.modules.training.models import TrainingSession

logger = logging.getLogger(__name__)

LOCK_KEY = "lock:refresh_leaderboards"
LOCK_TTL = 300  # 5 minutes


def _current_week_start() -> date:
    """Return Monday of the current ISO week."""
    today = date.today()
    return today - timedelta(days=today.weekday())


def _compute_volume(exercises: list | str | None) -> float:
    """Sum weight_kg * reps across all sets. Handles JSONB as list or string."""
    if not exercises:
        return 0.0
    if isinstance(exercises, str):
        try:
            exercises = json.loads(exercises)
        except (json.JSONDecodeError, TypeError):
            return 0.0
    total = 0.0
    for ex in exercises:
        for s in ex.get("sets", []):
            w = s.get("weight_kg", 0)
            r = s.get("reps", 0)
            if isinstance(w, (int, float)) and isinstance(r, (int, float)):
                total += w * r
    return total


def _compute_current_streak(dates: list[date]) -> int:
    """Compute current streak length from sorted distinct dates (desc)."""
    if not dates:
        return 0
    today = date.today()
    # Must include today or yesterday to be "current"
    if dates[0] < today - timedelta(days=1):
        return 0
    streak = 1
    for i in range(1, len(dates)):
        if dates[i - 1] - dates[i] == timedelta(days=1):
            streak += 1
        else:
            break
    return streak


async def refresh_leaderboards() -> None:
    """Calculate and upsert weekly_volume and streak leaderboards."""
    start_time = time.monotonic()
    logger.info("Leaderboard refresh started")
    sentry_sdk.set_tag('component', 'job')
    sentry_sdk.set_tag('job_name', 'refresh_leaderboards')

    redis = get_redis()
    if redis and not redis.set(LOCK_KEY, "1", nx=True, ex=LOCK_TTL):
        logger.info("Leaderboard refresh already running, skipping")
        return

    try:
        async with async_session_factory() as session:
            week_start = _current_week_start()

            # ── Weekly Volume ─────────────────────────────────────
            stmt = select(TrainingSession).where(
                TrainingSession.session_date >= week_start,
                TrainingSession.deleted_at.is_(None),
            )
            result = await session.execute(stmt)
            sessions = result.scalars().all()

            volume_by_user: dict[str, float] = defaultdict(float)
            for s in sessions:
                volume_by_user[str(s.user_id)] += _compute_volume(s.exercises)

            # Sort and rank top 200
            ranked_volume = sorted(volume_by_user.items(), key=lambda x: x[1], reverse=True)[:200]

            # Clear old entries for this period, then insert fresh
            await session.execute(
                delete(LeaderboardEntry).where(
                    LeaderboardEntry.board_type == "weekly_volume",
                    LeaderboardEntry.period_start == week_start,
                )
            )
            session.add_all([
                LeaderboardEntry(
                    board_type="weekly_volume",
                    period_start=week_start,
                    user_id=user_id,
                    score=float(score),
                    rank=rank,
                )
                for rank, (user_id, score) in enumerate(ranked_volume, 1)
            ])

            # ── Streak ────────────────────────────────────────────
            stmt_all = select(
                TrainingSession.user_id, TrainingSession.session_date
            ).where(
                TrainingSession.deleted_at.is_(None),
            ).distinct()
            result_all = await session.execute(stmt_all)

            dates_by_user: dict[str, list[date]] = defaultdict(list)
            for uid, sd in result_all.all():
                dates_by_user[str(uid)].append(sd)

            streak_scores: list[tuple[str, int]] = []
            for uid, dates in dates_by_user.items():
                sorted_dates = sorted(set(dates), reverse=True)
                streak = _compute_current_streak(sorted_dates)
                if streak > 0:
                    streak_scores.append((uid, streak))

            streak_scores.sort(key=lambda x: x[1], reverse=True)
            ranked_streaks = streak_scores[:200]

            await session.execute(
                delete(LeaderboardEntry).where(
                    LeaderboardEntry.board_type == "streak",
                    LeaderboardEntry.period_start == week_start,
                )
            )
            session.add_all([
                LeaderboardEntry(
                    board_type="streak",
                    period_start=week_start,
                    user_id=user_id,
                    score=float(streak_len),
                    rank=rank,
                )
                for rank, (user_id, streak_len) in enumerate(ranked_streaks, 1)
            ])

            await session.commit()

            elapsed = time.monotonic() - start_time
            logger.info(
                "Leaderboard refresh complete: %d volume, %d streak entries in %.1fs",
                len(ranked_volume), len(ranked_streaks), elapsed,
            )
    except (SQLAlchemyError, OSError, ValueError):
        sentry_sdk.capture_exception()
        raise
    finally:
        if redis:
            redis.delete(LOCK_KEY)


if __name__ == "__main__":
    asyncio.run(refresh_leaderboards())
