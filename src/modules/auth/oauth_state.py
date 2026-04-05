# Audit fix 2.3 — OAuth state CSRF protection
"""In-memory OAuth state store for CSRF protection (web flow)."""

import secrets
import time

_STATE_TTL = 300  # 5 minutes
_MAX_ENTRIES = 10_000
_store: dict[str, float] = {}  # state -> expiry timestamp


def _cleanup() -> None:
    """Remove expired entries."""
    now = time.time()
    expired = [k for k, v in _store.items() if v < now]
    for k in expired:
        del _store[k]


def generate_state() -> str:
    """Generate a random state token with 5-minute TTL."""
    _cleanup()
    if len(_store) >= _MAX_ENTRIES:
        # Evict oldest entries
        oldest = sorted(_store, key=_store.get)[:1000]  # type: ignore[arg-type]
        for k in oldest:
            del _store[k]
    token = secrets.token_urlsafe(32)
    _store[token] = time.time() + _STATE_TTL
    return token


def validate_state(state: str) -> bool:
    """Check state exists and is not expired, then remove it (one-time use)."""
    _cleanup()
    expiry = _store.pop(state, None)
    if expiry is None:
        return False
    return expiry >= time.time()
