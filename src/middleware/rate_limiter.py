"""Rate limiter for login attempts — Redis-backed with in-memory fallback."""

import logging
import os
import threading
import time

import redis.exceptions

from src.config.redis import get_redis
from src.config.settings import settings
from src.shared.errors import RateLimitedError
from src.shared.security_logger import log_rate_limit_hit

logger = logging.getLogger("security")

# ---------------------------------------------------------------------------
# In-memory fallback for auth-critical rate limiting when Redis is unavailable.
# Uses a simple dict of {key: [timestamps]} with a lock for thread safety.
# This is per-process only — not shared across Gunicorn workers — but still
# provides meaningful brute-force protection vs. no limiting at all.
# ---------------------------------------------------------------------------
_mem_lock = threading.Lock()
_mem_store: dict[str, list[float]] = {}

# Categories that MUST be rate-limited even without Redis (auth-critical)
_AUTH_CRITICAL_CATEGORIES = frozenset({
    "login", "lockout", "login_ip", "forgot_password",
    "reset_password", "register", "oauth",
})


def _memory_sliding_window_check(
    category: str, identifier: str, max_attempts: int, window_seconds: int, message: str
) -> None:
    """In-memory fallback rate limiter. Thread-safe, per-process only.

    Only checks the count — does NOT add a new entry. Recording is done
    separately via _memory_record to match the Redis pattern where
    check and record are independent operations.
    """
    key = f"rl:{category}:{identifier}"
    now = time.time()
    cutoff = now - window_seconds

    with _mem_lock:
        entries = _mem_store.get(key, [])
        entries = [t for t in entries if t > cutoff]
        _mem_store[key] = entries

        if len(entries) >= max_attempts:
            log_rate_limit_hit(ip="", endpoint=category, identifier=identifier)
            raise RateLimitedError(message=message, retry_after=window_seconds)


def _memory_record(category: str, identifier: str, window_seconds: int) -> None:
    """Record an attempt in the in-memory fallback store."""
    key = f"rl:{category}:{identifier}"
    now = time.time()
    cutoff = now - window_seconds

    with _mem_lock:
        entries = _mem_store.get(key, [])
        entries = [t for t in entries if t > cutoff]
        entries.append(now)
        _mem_store[key] = entries


def _memory_clear(category: str, identifier: str) -> None:
    """Clear in-memory rate limit entries for a key."""
    key = f"rl:{category}:{identifier}"
    with _mem_lock:
        _mem_store.pop(key, None)


def _redis_sliding_window_check(
    category: str, identifier: str, max_attempts: int, window_seconds: int, message: str
) -> None:
    """Check rate limit using Redis sorted set sliding window.

    Raises RateLimitedError if limit exceeded.
    If Redis is unavailable, falls back to in-memory limiting for
    auth-critical categories, and fails open for non-critical ones.
    """
    r = get_redis()
    if r is None:
        if category in _AUTH_CRITICAL_CATEGORIES:
            logger.warning("[RateLimiter] Redis unavailable, using in-memory fallback for %s:%s", category, identifier)
            _memory_sliding_window_check(category, identifier, max_attempts, window_seconds, message)
            return
        logger.warning("[RateLimiter] Redis unavailable, failing open for %s:%s", category, identifier)
        return

    now = time.time()
    cutoff = now - window_seconds
    redis_key = f"rl:{category}:{identifier}"

    try:
        pipe = r.pipeline()
        pipe.zremrangebyscore(redis_key, 0, cutoff)
        pipe.zcard(redis_key)
        results = pipe.execute()
        count = results[1]

        if count >= max_attempts:
            log_rate_limit_hit(ip="", endpoint=category, identifier=identifier)
            raise RateLimitedError(message=message, retry_after=window_seconds)
    except RateLimitedError:
        raise
    except (redis.exceptions.RedisError, ConnectionError, TimeoutError) as exc:
        logger.warning("[RateLimiter] Redis check failed (%s): %s", type(exc).__name__, exc)
        if category in _AUTH_CRITICAL_CATEGORIES:
            _memory_sliding_window_check(category, identifier, max_attempts, window_seconds, message)


def _redis_record(category: str, identifier: str, window_seconds: int) -> None:
    """Record an attempt in Redis sorted set."""
    r = get_redis()
    if r is None:
        if category in _AUTH_CRITICAL_CATEGORIES:
            _memory_record(category, identifier, window_seconds)
        return
    try:
        now = time.time()
        redis_key = f"rl:{category}:{identifier}"
        pipe = r.pipeline()
        pipe.zadd(redis_key, {f"{now}:{os.urandom(4).hex()}": now})
        pipe.expire(redis_key, window_seconds)
        pipe.execute()
    except (redis.exceptions.RedisError, ConnectionError, TimeoutError) as exc:
        logger.warning("[RateLimiter] Redis record failed: %s", exc)
        if category in _AUTH_CRITICAL_CATEGORIES:
            _memory_record(category, identifier, window_seconds)


def _redis_clear(category: str, identifier: str) -> None:
    """Clear rate limit entries for a key in Redis."""
    r = get_redis()
    if r is None:
        _memory_clear(category, identifier)
        return
    try:
        r.delete(f"rl:{category}:{identifier}")
        _memory_clear(category, identifier)
    except (redis.exceptions.RedisError, ConnectionError, TimeoutError) as exc:
        logger.warning("[RateLimiter] Redis reset failed (%s): %s", type(exc).__name__, exc)
        _memory_clear(category, identifier)


def check_rate_limit(email: str) -> None:
    """Check if the email has exceeded the login rate limit."""
    _redis_sliding_window_check(
        "login", email,
        settings.LOGIN_RATE_LIMIT_THRESHOLD,
        settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
        "Too many login attempts. Please try again later.",
    )


def record_attempt(email: str) -> None:
    """Record a failed login attempt for the given email."""
    _redis_record("login", email, settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS)
    _redis_record("lockout", email, 86400)


def reset_attempts(email: str) -> None:
    """Clear login attempts for an email (e.g. after successful login)."""
    _redis_clear("login", email)


def check_lockout(email: str) -> None:
    """Block login if the account has hit rate limits too many times (escalating lockout)."""
    _redis_sliding_window_check(
        "lockout", email, 3, 86400,
        "Account temporarily locked due to repeated failed attempts. Try again later.",
    )


def check_login_ip_rate_limit(ip: str) -> None:
    """Max 20 login attempts per IP per 15 minutes."""
    _redis_sliding_window_check(
        "login_ip", ip, 20, 900,
        "Too many login attempts from this address. Please try again later.",
    )


def check_forgot_password_rate_limit(email: str) -> None:
    """Max 3 forgot-password requests per email per 15 minutes."""
    _redis_sliding_window_check(
        "forgot_password", email, 3, 900,
        "Too many password reset requests. Please try again later.",
    )


def check_reset_password_rate_limit(email: str) -> None:
    """Max 5 reset-password attempts per email per 15 minutes."""
    _redis_sliding_window_check(
        "reset_password", email, 5, 900,
        "Too many password reset attempts. Please try again later.",
    )


def check_register_rate_limit(ip: str) -> None:
    """Max 5 registration attempts per IP per hour."""
    _redis_sliding_window_check(
        "register", ip, 5, 3600,
        "Too many registration attempts. Please try again later.",
    )


def check_oauth_rate_limit(ip: str) -> None:
    """Max 10 OAuth attempts per IP per 15 minutes."""
    _redis_sliding_window_check(
        "oauth", ip, 10, 900,
        "Too many OAuth attempts. Please try again later.",
    )


def check_user_endpoint_rate_limit(
    user_id: str, endpoint: str, max_attempts: int, window_seconds: int
) -> None:
    """Rate limit a specific endpoint per authenticated user."""
    _redis_sliding_window_check(
        f"user:{endpoint}", user_id, max_attempts, window_seconds,
        "Too many requests to this endpoint. Please try again later.",
    )


def clear_all() -> None:
    """Clear all rate limit state. Useful for testing."""
    with _mem_lock:
        _mem_store.clear()
