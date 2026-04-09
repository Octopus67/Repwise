# Audit fix 2.3 — OAuth state CSRF protection
"""In-memory OAuth state store for CSRF protection (web flow), with Redis-backed storage."""

import logging
import secrets
import time

from src.config.redis import get_redis

logger = logging.getLogger(__name__)

_STATE_TTL = 300  # 5 minutes
_MAX_ENTRIES = 10_000
_store: dict[str, float] = {}  # state -> expiry timestamp (in-memory fallback)

_REDIS_PREFIX = "oauth_state:"


def _cleanup() -> None:
    """Remove expired entries from in-memory store."""
    now = time.time()
    expired = [k for k, v in _store.items() if v < now]
    for k in expired:
        del _store[k]


def generate_state() -> str:
    """Generate a random state token with 5-minute TTL."""
    token = secrets.token_urlsafe(32)

    # Try Redis first
    r = get_redis()
    if r is not None:
        try:
            r.setex(f"{_REDIS_PREFIX}{token}", _STATE_TTL, "1")
            return token
        except Exception:
            logger.warning("Redis write failed for oauth state, falling back to in-memory")

    # In-memory fallback
    _cleanup()
    if len(_store) >= _MAX_ENTRIES:
        oldest = sorted(_store, key=_store.get)[:1000]  # type: ignore[arg-type]
        for k in oldest:
            del _store[k]
    _store[token] = time.time() + _STATE_TTL
    return token


def validate_state(state: str) -> bool:
    """Check state exists and is not expired, then remove it (one-time use)."""
    # Try Redis first
    r = get_redis()
    if r is not None:
        try:
            result = r.delete(f"{_REDIS_PREFIX}{state}")
            if result:
                return True
            # If not in Redis, fall through to check in-memory (migration case)
        except Exception:
            logger.warning("Redis read failed for oauth state, falling back to in-memory")

    # In-memory fallback
    _cleanup()
    expiry = _store.pop(state, None)
    if expiry is None:
        return False
    return expiry >= time.time()
