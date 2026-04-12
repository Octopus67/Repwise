"""Trial expiration job — downgrades expired trial subscriptions.

Schedule: hourly via APScheduler or system cron.
Usage:
    python -m src.jobs.trial_expiration
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

import sentry_sdk
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import async_session_factory
from src.modules.notifications.service import NotificationService
from src.modules.payments.constants import WINBACK_DISCOUNT_PCT, WINBACK_WINDOW_HOURS
from src.modules.payments.models import Subscription
from src.shared.types import SubscriptionStatus

logger = logging.getLogger(__name__)


async def run_trial_expiration(session: AsyncSession | None = None) -> int:
    """Expire trial subscriptions past their end date. Returns count expired."""
    start = time.monotonic()
    logger.info("Trial expiration job started")
    sentry_sdk.set_tag("component", "job")
    sentry_sdk.set_tag("job_name", "trial_expiration")
    owns_session = session is None
    if owns_session:
        async with async_session_factory() as session:
            try:
                count = await _expire_trials(session)
                await session.commit()
                elapsed = time.monotonic() - start
                logger.info("Trial expiration job complete: %d expired in %.1fs", count, elapsed)
                return count
            except (SQLAlchemyError, OSError, ValueError):
                await session.rollback()
                sentry_sdk.capture_exception()
                raise
    else:
        count = await _expire_trials(session)
        elapsed = time.monotonic() - start
        logger.info("Trial expiration job complete: %d expired in %.1fs", count, elapsed)
        return count


async def _expire_trials(session: AsyncSession) -> int:
    """Find and downgrade expired trial subscriptions with per-item isolation."""
    now = datetime.now(timezone.utc)

    stmt = select(Subscription).where(
        Subscription.is_trial.is_(True),
        Subscription.status == SubscriptionStatus.ACTIVE,
        Subscription.current_period_end <= now,
        Subscription.deleted_at.is_(None),
    )
    result = await session.execute(stmt)
    expired = result.scalars().all()

    notif_svc = NotificationService(session)
    count = 0
    for sub in expired:
        try:
            # Race guard: re-check status hasn't changed (e.g. webhook upgraded)
            if sub.status != SubscriptionStatus.ACTIVE:
                continue
            sub.status = SubscriptionStatus.FREE
            await session.flush()
            count += 1
            logger.info("Expired trial subscription %s for user %s", sub.id, sub.user_id)
        except (SQLAlchemyError, OSError, ValueError):
            logger.exception("Failed to expire trial %s for user %s", sub.id, sub.user_id)
            continue

        try:
            await notif_svc.send_push(
                user_id=sub.user_id,
                title="Your trial ended — but we have a deal 🎁",
                body=f"Get {WINBACK_DISCOUNT_PCT}% off Premium for the next {WINBACK_WINDOW_HOURS} hours!",
                notification_type="winback_offer",
            )
        except (SQLAlchemyError, OSError, ValueError):
            logger.exception("Failed to send winback push for user %s", sub.user_id)

    return count


if __name__ == "__main__":
    asyncio.run(run_trial_expiration())
