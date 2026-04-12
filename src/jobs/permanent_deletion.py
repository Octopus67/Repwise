"""GDPR permanent deletion job — hard-deletes accounts past the 30-day grace period.

Schedule: daily via APScheduler or system cron.
Usage:
    python -m src.jobs.permanent_deletion
"""

from __future__ import annotations

import asyncio
import logging
import time

import sentry_sdk
from sqlalchemy.exc import SQLAlchemyError

from src.config.database import async_session_factory
from src.modules.account.service import AccountService

logger = logging.getLogger(__name__)


async def run_permanent_deletion() -> int:
    """Permanently delete accounts whose grace period has expired. Returns count deleted."""
    start = time.monotonic()
    logger.info("Permanent deletion job started")
    sentry_sdk.set_tag("component", "job")
    sentry_sdk.set_tag("job_name", "permanent_deletion")

    deleted = 0
    async with async_session_factory() as session:
        svc = AccountService(session)
        try:
            count = await svc.permanently_delete_expired_accounts()
            await session.commit()
            deleted = count
        except (SQLAlchemyError, OSError, ValueError):
            await session.rollback()
            logger.exception("Permanent deletion job failed")
            sentry_sdk.capture_exception()
            raise

    elapsed = time.monotonic() - start
    logger.info("Permanent deletion job complete: %d deleted in %.1fs", deleted, elapsed)
    return deleted


if __name__ == "__main__":
    asyncio.run(run_permanent_deletion())
