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
# Audit fix 6.2 — bounded in-memory store
_MEM_STORE_MAX_KEYS = 10_000
_mem_check_counter = 0

# Categories that MUST be rate-limited even without Redis (auth-critical)
_AUTH_CRITICAL_CATEGORIES = frozenset(
    {
        "login",
        "lockout",
        "login_ip",
        "forgot_password",
        "reset_password",
        "register",
        "oauth",
    }
)


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
    global _mem_check_counter
    key = f"rl:{category}:{identifier}"
    now = time.time()
    cutoff = now - window_seconds

    with _mem_lock:
        # Audit fix 6.2 — periodic cleanup of expired timestamps
        _mem_check_counter += 1
        if _mem_check_counter % 1000 == 0:
            expired_keys = [k for k, v in _mem_store.items() if not v or v[-1] < cutoff]
            for k in expired_keys:
                del _mem_store[k]

        entries = _mem_store.get(key, [])
        entries = [t for t in entries if t > cutoff]
        entries.append(now)
        _mem_store[key] = entries

        # Audit fix 6.2 — evict oldest entries when store exceeds max size
        if len(_mem_store) > _MEM_STORE_MAX_KEYS:
            oldest_key = min(_mem_store, key=lambda k: _mem_store[k][0] if _mem_store[k] else 0)
            del _mem_store[oldest_key]


def _memory_clear(category: str, identifier: str) -> None:
    """Clear in-memory rate limit entries for a key."""
    key = f"rl:{category}:{identifier}"
    with _mem_lock:
        _mem_store.pop(key, None)


async def _redis_sliding_window_check(
    category: str, identifier: str, max_attempts: int, window_seconds: int, message: str
) -> None:
    """Check rate limit using Redis sorted set sliding window.

    Raises RateLimitedError if limit exceeded.
    If Redis is unavailable, falls back to in-memory limiting for
    auth-critical categories, and fails open for non-critical ones.
    """
    r = await get_redis()
    if r is None:
        if category in _AUTH_CRITICAL_CATEGORIES:
            logger.warning(
                "[RateLimiter] Redis unavailable, using in-memory fallback for %s:%s",
                category,
                identifier,
            )
            _memory_sliding_window_check(
                category, identifier, max_attempts, window_seconds, message
            )
            return
        logger.warning(
            "[RateLimiter] Redis unavailable, failing open for %s:%s", category, identifier
        )
        return

    now = time.time()
    cutoff = now - window_seconds
    redis_key = f"rl:{category}:{identifier}"

    try:
        pipe = r.pipeline()
        pipe.zremrangebyscore(redis_key, 0, cutoff)
        pipe.zcard(redis_key)
        results = await pipe.execute()
        count = results[1]

        if count >= max_attempts:
            log_rate_limit_hit(ip="", endpoint=category, identifier=identifier)
            raise RateLimitedError(message=message, retry_after=window_seconds)
    except RateLimitedError:
        raise
    except (redis.exceptions.RedisError, ConnectionError, TimeoutError) as exc:
        logger.warning("[RateLimiter] Redis check failed (%s): %s", type(exc).__name__, exc)
        if category in _AUTH_CRITICAL_CATEGORIES:
            _memory_sliding_window_check(
                category, identifier, max_attempts, window_seconds, message
            )


async def _redis_record(category: str, identifier: str, window_seconds: int) -> None:
    """Record an attempt in Redis sorted set."""
    r = await get_redis()
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
        await pipe.execute()
    except (redis.exceptions.RedisError, ConnectionError, TimeoutError) as exc:
        logger.warning("[RateLimiter] Redis record failed: %s", exc)
        if category in _AUTH_CRITICAL_CATEGORIES:
            _memory_record(category, identifier, window_seconds)


async def _redis_clear(category: str, identifier: str) -> None:
    """Clear rate limit entries for a key in Redis."""
    r = await get_redis()
    if r is None:
        _memory_clear(category, identifier)
        return
    try:
        await r.delete(f"rl:{category}:{identifier}")
        _memory_clear(category, identifier)
    except (redis.exceptions.RedisError, ConnectionError, TimeoutError) as exc:
        logger.warning("[RateLimiter] Redis reset failed (%s): %s", type(exc).__name__, exc)
        _memory_clear(category, identifier)


async def check_rate_limit(email: str) -> None:
    """Check if the email has exceeded the login rate limit."""
    await _redis_sliding_window_check(
        "login",
        email,
        settings.LOGIN_RATE_LIMIT_THRESHOLD,
        settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
        "Too many login attempts. Please try again later.",
    )


async def record_attempt(email: str) -> None:
    """Record a failed login attempt for the given email."""
    await _redis_record("login", email, settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS)
    await _redis_record("lockout", email, 86400)


async def reset_attempts(email: str) -> None:
    """Clear login attempts for an email (e.g. after successful login)."""
    await _redis_clear("login", email)


async def _get_lockout_failure_count(email: str) -> int:
    """Return the number of lockout entries for the email in the last 24h."""
    r = await get_redis()
    if r is None:
        key = f"rl:lockout:{email}"
        now = time.time()
        with _mem_lock:
            entries = _mem_store.get(key, [])
            return len([t for t in entries if t > now - 86400])
    try:
        redis_key = f"rl:lockout:{email}"
        now = time.time()
        pipe = r.pipeline()
        pipe.zremrangebyscore(redis_key, 0, now - 86400)
        pipe.zcard(redis_key)
        results = await pipe.execute()
        return results[1]
    except (redis.exceptions.RedisError, ConnectionError, TimeoutError):
        return 0


# Exponential backoff thresholds: (failure_count, cooldown_seconds)
_LOCKOUT_TIERS = [
    (10, 3600),  # 10+ failures → 1 hour
    (8, 900),  # 8+ failures → 15 min
    (5, 300),  # 5+ failures → 5 min
    (3, 60),  # 3+ failures → 1 min
]


async def check_lockout(email: str) -> None:
    """Block login with exponential backoff based on consecutive failure count."""
    failures = await _get_lockout_failure_count(email)
    for threshold, cooldown in _LOCKOUT_TIERS:
        if failures >= threshold:
            await _redis_sliding_window_check(
                "lockout",
                email,
                threshold,
                cooldown,
                f"Account temporarily locked ({cooldown // 60}min cooldown). Try again later.",
            )
            return


async def check_login_ip_rate_limit(ip: str) -> None:
    """Max 20 login attempts per IP per 15 minutes."""
    await _redis_sliding_window_check(
        "login_ip",
        ip,
        20,
        900,
        "Too many login attempts from this address. Please try again later.",
    )


async def check_forgot_password_rate_limit(email: str) -> None:
    """Max 3 forgot-password requests per email per 15 minutes."""
    await _redis_sliding_window_check(
        "forgot_password",
        email,
        3,
        900,
        "Too many password reset requests. Please try again later.",
    )


async def check_reset_password_rate_limit(email: str) -> None:
    """Max 5 reset-password attempts per email per 15 minutes."""
    await _redis_sliding_window_check(
        "reset_password",
        email,
        5,
        900,
        "Too many password reset attempts. Please try again later.",
    )


async def check_register_rate_limit(ip: str) -> None:
    """Max 5 registration attempts per IP per hour."""
    await _redis_sliding_window_check(
        "register",
        ip,
        5,
        3600,
        "Too many registration attempts. Please try again later.",
    )


async def check_oauth_rate_limit(ip: str) -> None:
    """Max 10 OAuth attempts per IP per 15 minutes."""
    await _redis_sliding_window_check(
        "oauth",
        ip,
        10,
        900,
        "Too many OAuth attempts. Please try again later.",
    )


async def check_user_endpoint_rate_limit(
    user_id: str, endpoint: str, max_attempts: int, window_seconds: int
) -> None:
    """Rate limit a specific endpoint per authenticated user."""
    await _redis_sliding_window_check(
        f"user:{endpoint}",
        user_id,
        max_attempts,
        window_seconds,
        "Too many requests to this endpoint. Please try again later.",
    )


# Audit fix 10.4 — IP-based rate limit for public endpoints
async def check_ip_endpoint_rate_limit(
    ip: str, endpoint: str, max_attempts: int, window_seconds: int
) -> None:
    """Rate limit a specific endpoint per IP address, and record the attempt."""
    await _redis_sliding_window_check(
        f"ip:{endpoint}",
        ip,
        max_attempts,
        window_seconds,
        "Too many requests. Please try again later.",
    )
    await _redis_record(f"ip:{endpoint}", ip, window_seconds)


def clear_all() -> None:
    """Clear all rate limit state. Useful for testing."""
    with _mem_lock:
        _mem_store.clear()


# ── Async aliases (functions are now natively async — aliases kept for backward compat) ──

async_check_rate_limit = check_rate_limit
async_record_attempt = record_attempt
async_reset_attempts = reset_attempts
async_check_lockout = check_lockout
async_check_login_ip_rate_limit = check_login_ip_rate_limit
async_check_forgot_password_rate_limit = check_forgot_password_rate_limit
async_check_reset_password_rate_limit = check_reset_password_rate_limit
async_check_register_rate_limit = check_register_rate_limit
async_check_oauth_rate_limit = check_oauth_rate_limit
async_check_user_endpoint_rate_limit = check_user_endpoint_rate_limit
async_check_ip_endpoint_rate_limit = check_ip_endpoint_rate_limit
