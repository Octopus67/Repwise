"""Retry decorators with exponential backoff and jitter.

Stdlib-only — no external dependencies (no tenacity).
Provides both async and sync variants.
"""

import asyncio
import logging
import random
import time
from functools import wraps
from typing import Any, Callable, Sequence

logger = logging.getLogger(__name__)


def async_retry(
    max_retries: int = 3,
    base_delay: float = 0.5,
    max_delay: float = 10.0,
    retryable_exceptions: Sequence[type[BaseException]] = (Exception,),
) -> Callable:
    """Async retry decorator with exponential backoff and jitter."""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exception: BaseException | None = None
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except tuple(retryable_exceptions) as e:
                    last_exception = e
                    if attempt == max_retries:
                        logger.error(
                            "[Retry] %s failed after %d attempts: %s",
                            func.__name__,
                            max_retries + 1,
                            str(e),
                        )
                        raise
                    delay = min(base_delay * (2**attempt) + random.uniform(0, 0.5), max_delay)
                    logger.warning(
                        "[Retry] %s attempt %d/%d failed (%s), retrying in %.1fs",
                        func.__name__,
                        attempt + 1,
                        max_retries + 1,
                        type(e).__name__,
                        delay,
                    )
                    await asyncio.sleep(delay)
            raise last_exception  # type: ignore[misc]  # unreachable but satisfies type checker

        return wrapper

    return decorator


def sync_retry(
    max_retries: int = 3,
    base_delay: float = 0.5,
    max_delay: float = 10.0,
    retryable_exceptions: Sequence[type[BaseException]] = (Exception,),
) -> Callable:
    """Sync retry decorator with exponential backoff and jitter."""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exception: BaseException | None = None
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except tuple(retryable_exceptions) as e:
                    last_exception = e
                    if attempt == max_retries:
                        logger.error(
                            "[Retry] %s failed after %d attempts: %s",
                            func.__name__,
                            max_retries + 1,
                            str(e),
                        )
                        raise
                    delay = min(base_delay * (2**attempt) + random.uniform(0, 0.5), max_delay)
                    logger.warning(
                        "[Retry] %s attempt %d/%d failed (%s), retrying in %.1fs",
                        func.__name__,
                        attempt + 1,
                        max_retries + 1,
                        type(e).__name__,
                        delay,
                    )
                    time.sleep(delay)
            raise last_exception  # type: ignore[misc]  # unreachable but satisfies type checker

        return wrapper

    return decorator
