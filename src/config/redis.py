"""Redis connection singleton for rate limiting and shared state."""

import logging
import time
from typing import Optional

import redis
import redis.exceptions
import sentry_sdk

from src.config.settings import settings

logger = logging.getLogger("security")

_redis_client: Optional[redis.Redis] = None
_redis_unavailable_until: float = 0.0
_REDIS_RETRY_SECONDS = 60


def get_redis() -> Optional[redis.Redis]:
    """Return the Redis client singleton. Returns None if unavailable."""
    global _redis_client, _redis_unavailable_until

    if not settings.REDIS_URL:
        return None

    if _redis_unavailable_until and time.time() < _redis_unavailable_until:
        return None

    if _redis_client is not None:
        return _redis_client

    try:
        _redis_client = redis.from_url(
            settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2
        )
        _redis_client.ping()
        logger.info("Redis connected")
        _redis_unavailable_until = 0.0
        return _redis_client
    except (redis.exceptions.RedisError, ConnectionError, TimeoutError) as exc:
        sentry_sdk.set_tag('component', 'redis')
        sentry_sdk.capture_message(f'Redis connection failed: {exc}', level='warning')
        logger.warning("[Redis] unavailable: %s", exc)
        _redis_unavailable_until = time.time() + _REDIS_RETRY_SECONDS
        _redis_client = None
        return None


def redis_health_check() -> bool:
    """Return True if Redis is reachable."""
    try:
        r = get_redis()
        if r is None:
            return False
        r.ping()
        return True
    except (redis.exceptions.RedisError, ConnectionError, TimeoutError):
        return False


def close_redis() -> None:
    """Close the Redis connection."""
    global _redis_client
    if _redis_client is not None:
        try:
            _redis_client.close()
        except OSError as exc:
            logger.warning("[Redis] close failed: %s", exc)
        _redis_client = None
