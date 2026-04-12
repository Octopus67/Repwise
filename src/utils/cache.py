"""Simple async Redis cache decorator."""

import functools
import json
import logging
from typing import Callable

from src.config.redis import get_redis

logger = logging.getLogger(__name__)


def async_cached(prefix: str, ttl: int = 300) -> Callable:
    """Decorator that caches async function results in Redis. Falls back to no-cache."""

    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            r = get_redis()
            key = f"{prefix}:{':'.join(str(a) for a in args)}:{':'.join(f'{k}={v}' for k, v in sorted(kwargs.items()))}"
            if r:
                try:
                    cached = r.get(key)
                    if cached is not None:
                        return json.loads(cached)
                except Exception:
                    logger.debug("Cache read failed for %s", key)
            result = await fn(*args, **kwargs)
            if r:
                try:
                    r.setex(key, ttl, json.dumps(result, default=str))
                except Exception:
                    logger.debug("Cache write failed for %s", key)
            return result

        return wrapper

    return decorator
