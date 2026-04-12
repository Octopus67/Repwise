"""DB-backed rate limiting for critical auth endpoints."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.middleware.rate_limit_models import RateLimitEntry
from src.shared.errors import RateLimitedError
from src.shared.security_logger import log_rate_limit_hit


async def check_db_rate_limit(
    session: AsyncSession,
    key: str,
    endpoint: str,
    max_attempts: int,
    window_seconds: int,
    message: str,
) -> None:
    """Check and record a rate-limited action in the database."""
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=window_seconds)

    count = (
        await session.execute(
            select(func.count())
            .select_from(RateLimitEntry)
            .where(
                RateLimitEntry.key == key,
                RateLimitEntry.endpoint == endpoint,
                RateLimitEntry.created_at > cutoff,
            )
        )
    ).scalar_one()

    if count >= max_attempts:
        log_rate_limit_hit(ip="", endpoint=endpoint, identifier=key)
        raise RateLimitedError(message=message, retry_after=window_seconds)


async def record_db_attempt(session: AsyncSession, key: str, endpoint: str) -> None:
    """Record a failed attempt in the database. Call only on auth failure."""
    session.add(RateLimitEntry(key=key, endpoint=endpoint))


async def reset_db_attempts(session: AsyncSession, key: str, endpoint: str) -> None:
    """Clear rate limit entries for a key after successful auth."""
    await session.execute(
        delete(RateLimitEntry).where(
            RateLimitEntry.key == key,
            RateLimitEntry.endpoint == endpoint,
        )
    )
    await session.flush()


async def cleanup_expired_entries(session: AsyncSession, max_age_seconds: int = 3600) -> int:
    """Purge rate limit entries older than max_age_seconds. Returns count deleted."""
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=max_age_seconds)
    result = await session.execute(delete(RateLimitEntry).where(RateLimitEntry.created_at < cutoff))
    await session.flush()
    return result.rowcount or 0
