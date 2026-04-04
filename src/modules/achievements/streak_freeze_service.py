"""Streak Freeze Service — 1 free freeze per calendar month, auto-applies for gaps <= 2 days."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.exc import IntegrityError

from src.modules.achievements.models import StreakFreeze

FREEZES_PER_MONTH = 2


async def get_available_freezes(session: AsyncSession, user_id: uuid.UUID, month_str: str) -> int:
    """Return remaining freezes for the given YYYY-MM month."""
    stmt = select(func.count()).select_from(StreakFreeze).where(
        StreakFreeze.user_id == user_id,
        StreakFreeze.month == month_str,
    )
    used = (await session.execute(stmt)).scalar_one()
    return max(0, FREEZES_PER_MONTH - used)


async def try_auto_freeze(
    session: AsyncSession,
    user_id: uuid.UUID,
    last_active_date: date,
    current_date: date,
) -> bool:
    """Auto-freeze gap days between last_active_date and current_date.

    Only applies if gap <= 2 days and a freeze is available for each gap day's month.
    Returns True if all gap days were frozen successfully.
    """
    gap = (current_date - last_active_date).days - 1  # days between, exclusive
    if gap < 1 or gap > 2:
        return False

    # Collect gap dates
    gap_dates = [last_active_date + timedelta(days=i) for i in range(1, gap + 1)]

    # Check availability for each gap day's month
    for d in gap_dates:
        month_str = d.strftime("%Y-%m")
        available = await get_available_freezes(session, user_id, month_str)
        if available < 1:
            return False

    # Create freeze records
    try:
        for d in gap_dates:
            month_str = d.strftime("%Y-%m")
            freeze = StreakFreeze(
                user_id=user_id,
                freeze_date=d,
                month=month_str,
                used_at=datetime.utcnow(),
            )
            session.add(freeze)

        await session.flush()
        return True
    except IntegrityError:
        await session.rollback()
        return False


async def get_freeze_history(session: AsyncSession, user_id: uuid.UUID) -> list[StreakFreeze]:
    """Return all freeze records for a user, newest first."""
    stmt = (
        select(StreakFreeze)
        .where(StreakFreeze.user_id == user_id)
        .order_by(StreakFreeze.freeze_date.desc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())
