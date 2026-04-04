"""Redis-backed sliding window rate limiter with in-memory fallback."""

import logging
import time
from typing import Optional

import redis.exceptions

from src.config.settings import settings
from src.shared.errors import RateLimitedError
from src.shared.security_logger import log_rate_limit_hit

logger = logging.getLogger("security")

_redis_client: Optional[object] = None
_redis_unavailable_until: float = 0.0
_REDIS_RETRY_SECONDS = 60


def _get_redis() -> Optional[object]:
    """Lazy-init Redis client. Returns None if unavailable."""
    global _redis_client, _redis_unavailable_until
    if not settings.REDIS_URL:
        return None
    if _redis_unavailable_until and time.time() < _redis_unavailable_until:
        return None
    if _redis_client is not None:
        return _redis_client
    try:
        import redis
        _redis_client = redis.from_url(
            settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2
        )
        _redis_client.ping()  # type: ignore[union-attr]
        logger.info("Redis rate limiter connected")
        _redis_unavailable_until = 0.0
        return _redis_client
    except (redis.exceptions.RedisError, ConnectionError, TimeoutError) as exc:
        logger.warning("[RedisRateLimiter] Redis unavailable, using in-memory fallback: %s", exc)
        _redis_unavailable_until = time.time() + _REDIS_RETRY_SECONDS
        _redis_client = None
        return None


def close_redis() -> None:
    """Close the Redis client connection if it exists."""
    global _redis_client
    if _redis_client is not None:
        try:
            _redis_client.close()  # type: ignore[union-attr]
        except (redis.exceptions.RedisError, ConnectionError, TimeoutError) as exc:
            logger.warning("[RedisRateLimiter] close failed: %s", exc)
        _redis_client = None


def redis_check_rate_limit(
    key: str, max_attempts: int, window_seconds: int, message: str
) -> None:
    """Check and record rate limit atomically using Redis sorted sets (sliding window).

    Returns None. Falls back silently if Redis is unavailable —
    callers should then use their in-memory logic.

    Raises RateLimitedError if limit exceeded.
    """
    r = _get_redis()
    if r is None:
        return  # Caller falls through to in-memory

    now = time.time()
    cutoff = now - window_seconds
    redis_key = f"rl:{key}"
    member = f"{now}"

    try:
        pipe = r.pipeline()  # type: ignore[union-attr]
        pipe.zremrangebyscore(redis_key, 0, cutoff)
        pipe.zadd(redis_key, {member: now})
        pipe.zcard(redis_key)
        pipe.expire(redis_key, window_seconds)
        results = pipe.execute()
        count = results[2]

        if count > max_attempts:
            # Over limit — remove the just-added entry and raise
            r.zrem(redis_key, member)  # type: ignore[union-attr]
            log_rate_limit_hit(ip="", endpoint=message, identifier=key)
            raise RateLimitedError(message=message, retry_after=window_seconds)

    except RateLimitedError:
        raise
    except (redis.exceptions.RedisError, ConnectionError, TimeoutError) as exc:
        logger.warning("[RedisRateLimiter] check failed (%s), skipping: %s", type(exc).__name__, exc)


def redis_record_attempt(key: str, window_seconds: int) -> bool:
    """Record an attempt in Redis. Returns True if recorded, False if Redis unavailable."""
    r = _get_redis()
    if r is None:
        return False
    try:
        now = time.time()
        redis_key = f"rl:{key}"
        pipe = r.pipeline()  # type: ignore[union-attr]
        pipe.zadd(redis_key, {f"{now}": now})
        pipe.expire(redis_key, window_seconds)
        pipe.execute()
        return True
    except (redis.exceptions.RedisError, ConnectionError, TimeoutError) as exc:
        logger.warning("[RedisRateLimiter] record failed: %s", exc)
        return False


def redis_reset(key: str) -> bool:
    """Clear rate limit entries for a key. Returns True if cleared via Redis."""
    r = _get_redis()
    if r is None:
        return False
    try:
        r.delete(f"rl:{key}")  # type: ignore[union-attr]
        return True
    except (redis.exceptions.RedisError, ConnectionError, TimeoutError) as exc:
        logger.warning("[RedisRateLimiter] reset failed: %s", exc)
        return False


def redis_check_global_rate_limit(ip: str, rpm: int, window: int) -> Optional[bool]:
    """Check global per-IP rate limit. Returns True=allowed, False=blocked, None=Redis unavailable."""
    r = _get_redis()
    if r is None:
        return None
    try:
        now = time.time()
        cutoff = now - window
        redis_key = f"rl:global:{ip}"

        pipe = r.pipeline()  # type: ignore[union-attr]
        pipe.zremrangebyscore(redis_key, 0, cutoff)
        pipe.zadd(redis_key, {f"{now}": now})
        pipe.zcard(redis_key)
        pipe.expire(redis_key, window)
        results = pipe.execute()
        count = results[2]

        return count <= rpm
    except (redis.exceptions.RedisError, ConnectionError, TimeoutError) as exc:
        logger.warning("[RedisRateLimiter] global check failed (%s): %s", type(exc).__name__, exc)
        return None


def redis_available() -> bool:
    """Check if Redis is configured and reachable."""
    return _get_redis() is not None
