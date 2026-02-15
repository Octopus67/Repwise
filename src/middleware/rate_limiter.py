"""Simple in-memory rate limiter for login attempts."""

import time

from src.config.settings import settings
from src.shared.errors import RateLimitedError

# In-memory store: email -> list of attempt timestamps
_login_attempts: dict[str, list[float]] = {}


def _prune_old_attempts(email: str) -> None:
    """Remove attempts older than the rate limit window."""
    if email not in _login_attempts:
        return
    cutoff = time.time() - settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS
    _login_attempts[email] = [t for t in _login_attempts[email] if t > cutoff]
    if not _login_attempts[email]:
        del _login_attempts[email]


def check_rate_limit(email: str) -> None:
    """Check if the email has exceeded the login rate limit.

    Raises RateLimitedError if attempts exceed the configured threshold
    within the rate limit window (default 15 minutes).
    """
    _prune_old_attempts(email)
    attempts = _login_attempts.get(email, [])
    if len(attempts) >= settings.LOGIN_RATE_LIMIT_THRESHOLD:
        raise RateLimitedError(
            message="Too many login attempts. Please try again later.",
            retry_after=settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
        )


def record_attempt(email: str) -> None:
    """Record a failed login attempt for the given email."""
    if email not in _login_attempts:
        _login_attempts[email] = []
    _login_attempts[email].append(time.time())


def reset_attempts(email: str) -> None:
    """Clear login attempts for an email (e.g. after successful login)."""
    _login_attempts.pop(email, None)


def clear_all() -> None:
    """Clear all rate limit state. Useful for testing."""
    _login_attempts.clear()
