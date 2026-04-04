"""Background worker for processing pending export requests.

Schedule: run periodically via APScheduler or cron.
Usage:
    python -m src.jobs.export_worker          # one-shot
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timedelta, timezone

import sentry_sdk
from sqlalchemy import select, and_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import async_session_factory
from src.modules.export.models import ExportRequest
from src.modules.export.service import ExportService

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
STALE_PROCESSING_MINUTES = 5


async def _reset_stale_exports(session: AsyncSession) -> int:
    """Reset exports stuck in 'processing' for >5 minutes back to 'pending'."""
    cutoff = datetime.utcnow() - timedelta(minutes=STALE_PROCESSING_MINUTES)
    stmt = select(ExportRequest).where(
        and_(
            ExportRequest.status == "processing",
            ExportRequest.updated_at < cutoff,
            ExportRequest.retry_count < MAX_RETRIES,
        )
    )
    result = await session.execute(stmt)
    stale = list(result.scalars().all())
    for export in stale:
        export.status = "pending"
        export.retry_count = (export.retry_count or 0) + 1
        logger.warning("Reset stale export %s to pending (retry %d)", export.id, export.retry_count)
    # Fail exports that exceeded max retries
    stmt_failed = select(ExportRequest).where(
        and_(
            ExportRequest.status == "processing",
            ExportRequest.updated_at < cutoff,
            ExportRequest.retry_count >= MAX_RETRIES,
        )
    )
    result_failed = await session.execute(stmt_failed)
    for export in result_failed.scalars().all():
        export.status = "failed"
        export.error_message = "Export failed after maximum retries"
        logger.error("Export %s failed after %d retries", export.id, export.retry_count)
    return len(stale)


async def run_export_worker(session: AsyncSession | None = None) -> int:
    """Process all pending export requests. Returns count processed."""
    start = time.monotonic()
    logger.info("Export worker started")
    sentry_sdk.set_tag('component', 'job')
    sentry_sdk.set_tag('job_name', 'export_worker')
    owns_session = session is None
    if owns_session:
        session = async_session_factory()

    try:
        # Reset stale exports before processing
        reset_count = await _reset_stale_exports(session)
        if reset_count:
            logger.info("Reset %d stale exports to pending", reset_count)

        stmt = select(ExportRequest).where(
            and_(
                ExportRequest.status == "pending",
                ExportRequest.retry_count < MAX_RETRIES,
            )
        )
        result = await session.execute(stmt)
        pending = list(result.scalars().all())

        processed = 0
        service = ExportService(session)
        for export in pending:
            try:
                export.status = "processing"
                await session.flush()

                await service.generate_export(export.id)
                processed += 1
            except (SQLAlchemyError, OSError, ValueError):
                logger.exception("Failed to process export %s", export.id)
                export.retry_count = (export.retry_count or 0) + 1
                if export.retry_count >= MAX_RETRIES:
                    export.status = "failed"
                    export.error_message = "Export failed after maximum retries"
                else:
                    export.status = "pending"
                    export.error_message = "Export processing failed, will retry"
                await session.flush()

        if owns_session:
            await session.commit()

        elapsed = time.monotonic() - start
        logger.info("Export worker complete: %d/%d processed in %.1fs", processed, len(pending), elapsed)
        return processed
    except (SQLAlchemyError, OSError, ValueError):
        if owns_session:
            await session.rollback()
        sentry_sdk.capture_exception()
        raise
    finally:
        if owns_session:
            await session.close()


if __name__ == "__main__":
    asyncio.run(run_export_worker())
