"""Workout reminder job — sends push to users who haven't trained in 24h.

Schedule: every 2 hours via APScheduler or system cron.
Usage:
    python -m src.jobs.workout_reminders          # one-shot
    # Or register with APScheduler:
    # scheduler.add_job(run_workout_reminders, "cron", hour="*/2")
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import Counter
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import sentry_sdk
from sqlalchemy import extract, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import async_session_factory
from src.modules.auth.models import User
from src.modules.notifications.models import NotificationLog, NotificationPreference
from src.modules.notifications.service import NotificationService
from src.modules.training.models import TrainingSession
from src.modules.user.models import UserProfile

logger = logging.getLogger(__name__)


def _safe_tz(user_tz: str | None) -> timezone | ZoneInfo:
    """Return timezone, falling back to UTC on invalid input."""
    if not user_tz:
        return timezone.utc
    try:
        return ZoneInfo(user_tz)
    except (KeyError, ValueError):
        logger.warning("Invalid timezone '%s', falling back to UTC", user_tz)
        return timezone.utc


DEFAULT_WORKOUT_HOUR = 9
REMINDER_LEAD_HOURS = 1
SESSION_LOOKBACK_DAYS = 30


def is_in_quiet_hours(prefs: NotificationPreference, user_tz: str | None) -> bool:
    """Return True if the current time in the user's timezone falls within quiet hours."""
    if not prefs.quiet_hours_start or not prefs.quiet_hours_end:
        return False

    tz = _safe_tz(user_tz)
    now_local = datetime.now(tz).time()
    start = prefs.quiet_hours_start
    end = prefs.quiet_hours_end

    if start == end:
        return False  # Equal start/end means no quiet hours

    if start <= end:
        # e.g. 22:00–22:00 (same) or 09:00–17:00
        return start <= now_local <= end
    # Wraps midnight, e.g. 22:00–07:00
    return now_local >= start or now_local <= end


async def get_preferred_workout_hour(session: AsyncSession, user_id) -> int:
    """Return the most common start hour from the last 30 days of sessions (default 9)."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=SESSION_LOOKBACK_DAYS)
    stmt = (
        select(extract("hour", TrainingSession.start_time))
        .where(
            TrainingSession.user_id == user_id,
            TrainingSession.start_time.isnot(None),
            TrainingSession.session_date >= cutoff.date(),
        )
    )
    result = await session.execute(stmt)
    hours = [int(row[0]) for row in result.all()]
    if not hours:
        return DEFAULT_WORKOUT_HOUR
    return Counter(hours).most_common(1)[0][0]


async def run_workout_reminders(session: AsyncSession | None = None) -> int:
    """Send workout reminders to eligible users. Returns count of notifications sent."""
    start = time.monotonic()
    logger.info("Workout reminders job started")
    sentry_sdk.set_tag('component', 'job')
    sentry_sdk.set_tag('job_name', 'workout_reminders')
    owns_session = session is None
    if owns_session:
        session = async_session_factory()

    try:
        sent = await _send_reminders(session)
        if owns_session:
            await session.commit()
        elapsed = time.monotonic() - start
        logger.info("Workout reminders job complete: %d sent in %.1fs", sent, elapsed)
        return sent
    except (SQLAlchemyError, OSError, ValueError):
        if owns_session:
            await session.rollback()
        sentry_sdk.capture_exception()
        raise
    finally:
        if owns_session:
            await session.close()


async def _send_reminders(session: AsyncSession) -> int:
    """Core logic: find users without recent training and send reminders."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    today = datetime.now(timezone.utc).date()

    # Users who trained in the last 24h
    recent_trainers = (
        select(TrainingSession.user_id)
        .where(TrainingSession.session_date >= today - timedelta(days=1))
        .distinct()
    )

    # Users who already got a workout_reminder today
    already_notified = (
        select(NotificationLog.user_id)
        .where(
            NotificationLog.type == "workout_reminder",
            NotificationLog.sent_at >= cutoff,
        )
        .distinct()
    )

    # Users with workout_reminders enabled — also fetch prefs and timezone
    eligible = (
        select(User.id, NotificationPreference, UserProfile.timezone)
        .join(NotificationPreference, NotificationPreference.user_id == User.id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(
            NotificationPreference.push_enabled.is_(True),
            NotificationPreference.workout_reminders.is_(True),
            User.id.notin_(recent_trainers),
            User.id.notin_(already_notified),
        )
    )

    result = await session.execute(eligible)
    rows = result.all()

    sent = 0
    notif_svc = NotificationService(session)
    for uid, prefs, user_tz in rows:
        try:
            # Enforce quiet hours
            if is_in_quiet_hours(prefs, user_tz):
                continue

            # Smart timing: send reminder ~1h before preferred workout time
            preferred_hour = await get_preferred_workout_hour(session, uid)
            reminder_hour = (preferred_hour - REMINDER_LEAD_HOURS) % 24
            tz = _safe_tz(user_tz)
            current_hour = datetime.now(tz).hour
            hour_diff = min(abs(current_hour - reminder_hour), 24 - abs(current_hour - reminder_hour))
            if hour_diff > 1:
                continue

            count = await notif_svc.send_push(
                user_id=uid,
                title="Time to train!",
                body="You haven't logged a workout today",
                notification_type="workout_reminder",
                data={"screen": "Logs"},
            )
            if count > 0:
                sent += 1
        except (SQLAlchemyError, OSError, ValueError):
            logger.exception("Failed to send workout reminder to user %s", uid)

    logger.info("Workout reminders sent: %d / %d eligible", sent, len(rows))
    return sent


if __name__ == "__main__":
    asyncio.run(run_workout_reminders())
