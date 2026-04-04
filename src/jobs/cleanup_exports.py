"""Cleanup job for expired export files.

Schedule: daily via APScheduler or cron.
Usage:
    python -m src.jobs.cleanup_exports        # one-shot
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from pathlib import Path

import sentry_sdk
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import async_session_factory
from src.modules.export.models import ExportRequest

logger = logging.getLogger(__name__)


async def run_cleanup_exports(session: AsyncSession | None = None) -> int:
    """Delete expired export requests and their files. Returns count cleaned."""
    start = time.monotonic()
    logger.info("Export cleanup job started")
    sentry_sdk.set_tag('component', 'job')
    sentry_sdk.set_tag('job_name', 'cleanup_exports')
    owns_session = session is None
    if owns_session:
        session = async_session_factory()

    try:
        now = datetime.now(timezone.utc)
        stmt = select(ExportRequest).where(
            ExportRequest.expires_at.isnot(None),
            ExportRequest.expires_at <= now,
        )
        result = await session.execute(stmt)
        expired = list(result.scalars().all())

        cleaned = 0
        for export in expired:
            try:
                # Remove file first
                if export.download_url:
                    path = Path(export.download_url)
                    if path.exists():
                        path.unlink(missing_ok=True)
                await session.delete(export)
                await session.flush()
                cleaned += 1
            except (SQLAlchemyError, OSError):
                logger.exception("Failed to clean export %s", export.id)

        if owns_session:
            await session.commit()

        elapsed = time.monotonic() - start
        logger.info("Export cleanup complete: %d/%d cleaned in %.1fs", cleaned, len(expired), elapsed)
        return cleaned
    except (SQLAlchemyError, OSError):
        if owns_session:
            await session.rollback()
        sentry_sdk.capture_exception()
        raise
    finally:
        if owns_session:
            await session.close()


if __name__ == "__main__":
    asyncio.run(run_cleanup_exports())
