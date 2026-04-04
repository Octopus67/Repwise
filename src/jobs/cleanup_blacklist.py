"""Cleanup job for expired token blacklist entries.

Schedule: daily via APScheduler or cron.
Usage:
    python -m src.jobs.cleanup_blacklist        # one-shot
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

import sentry_sdk
from sqlalchemy import delete
from sqlalchemy.exc import SQLAlchemyError

from src.config.database import async_session_factory
from src.modules.auth.models import TokenBlacklist

logger = logging.getLogger(__name__)


async def cleanup_expired_blacklist_entries() -> int:
    """Delete expired blacklist entries. Returns count purged."""
    start = time.monotonic()
    logger.info("Blacklist cleanup job started")
    sentry_sdk.set_tag('component', 'job')
    sentry_sdk.set_tag('job_name', 'cleanup_blacklist')
    try:
        async with async_session_factory() as session:
            result = await session.execute(
                delete(TokenBlacklist).where(
                    TokenBlacklist.expires_at < datetime.utcnow()
                )
            )
            await session.commit()
            count = result.rowcount
            elapsed = time.monotonic() - start
            logger.info("Blacklist cleanup complete: %d purged in %.1fs", count, elapsed)
            return count
    except SQLAlchemyError:
        sentry_sdk.capture_exception()
        raise


if __name__ == "__main__":
    asyncio.run(cleanup_expired_blacklist_entries())
