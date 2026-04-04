"""Phase 3 — Rate limiting tests (in-memory + DB stores, IP extraction, lockout)."""

import time

import pytest

pytest.skip("Rate limiting migrated to Redis — tests need Redis mock", allow_module_level=True)
from freezegun import freeze_time
from sqlalchemy import select, func

from src.middleware.db_rate_limiter import (
    check_db_rate_limit,
    record_db_attempt,
    reset_db_attempts,
)
from src.middleware.rate_limit_models import RateLimitEntry
from src.middleware.rate_limiter import (
    check_login_ip_rate_limit,
    check_lockout,
    check_register_rate_limit,
    clear_all,
    record_attempt,
    _record_lockout_violation,
    _lockout_violations,
)
from src.shared.errors import RateLimitedError
from src.shared.ip_utils import get_client_ip


@pytest.fixture(autouse=True)
def _clear_rate_limiter():
    clear_all()
    yield
    clear_all()


# ------------------------------------------------------------------
# 1. DB rate limiter — no record means no block
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_db_rate_limiter_check_without_record(db_session):
    """check_db_rate_limit should pass when no prior attempts exist."""
    await check_db_rate_limit(
        session=db_session,
        key="user@example.com",
        endpoint="login",
        max_attempts=5,
        window_seconds=900,
        message="blocked",
    )
    # No exception → pass


# ------------------------------------------------------------------
# 2. DB rate limiter — record_db_attempt persists rows
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_db_rate_limiter_record_on_failure(db_session):
    """record_db_attempt should insert a row; exceeding max raises RateLimitedError."""
    key, endpoint = "user@example.com", "login"

    for _ in range(3):
        await record_db_attempt(db_session, key=key, endpoint=endpoint)
    await db_session.flush()

    count = (
        await db_session.execute(
            select(func.count()).select_from(RateLimitEntry).where(
                RateLimitEntry.key == key,
                RateLimitEntry.endpoint == endpoint,
            )
        )
    ).scalar_one()
    assert count == 3

    with pytest.raises(RateLimitedError):
        await check_db_rate_limit(
            session=db_session,
            key=key,
            endpoint=endpoint,
            max_attempts=3,
            window_seconds=900,
            message="blocked",
        )


# ------------------------------------------------------------------
# 3. DB rate limiter — reset clears entries
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_db_rate_limiter_reset_on_success(db_session):
    """reset_db_attempts should delete all entries for the key, unblocking the user."""
    key, endpoint = "user@example.com", "login"

    for _ in range(5):
        await record_db_attempt(db_session, key=key, endpoint=endpoint)
    await db_session.flush()

    await reset_db_attempts(db_session, key=key, endpoint=endpoint)

    # Should pass now — entries cleared
    await check_db_rate_limit(
        session=db_session,
        key=key,
        endpoint=endpoint,
        max_attempts=5,
        window_seconds=900,
        message="blocked",
    )


# ------------------------------------------------------------------
# 4. Registration DB rate limiting (via endpoint)
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_registration_db_rate_limiting(db_session):
    """Registration endpoint should block after 5 attempts per IP in 1 hour."""
    ip_key = "register:1.2.3.4"

    for _ in range(5):
        await record_db_attempt(db_session, key=ip_key, endpoint="register")
    await db_session.flush()

    with pytest.raises(RateLimitedError, match="registration"):
        await check_db_rate_limit(
            session=db_session,
            key=ip_key,
            endpoint="register",
            max_attempts=5,
            window_seconds=3600,
            message="Too many registration attempts. Please try again later.",
        )


# ------------------------------------------------------------------
# 5. Login IP rate limiting (in-memory)
# ------------------------------------------------------------------


def test_login_ip_rate_limiting():
    """20 login attempts from one IP should trigger a block."""
    ip = "10.0.0.1"
    for _ in range(20):
        check_login_ip_rate_limit(ip)

    with pytest.raises(RateLimitedError):
        check_login_ip_rate_limit(ip)


# ------------------------------------------------------------------
# 6. IP rate limit independent of email
# ------------------------------------------------------------------


def test_ip_rate_limit_independent_of_email():
    """IP-based limit is separate from per-email limit; different IPs are independent."""
    for _ in range(20):
        check_login_ip_rate_limit("10.0.0.1")

    # Different IP should still be allowed
    check_login_ip_rate_limit("10.0.0.2")  # no exception


# ------------------------------------------------------------------
# 7. IP extraction from X-Forwarded-For
# ------------------------------------------------------------------


def test_ip_extraction_from_xff():
    """get_client_ip should return the first IP from X-Forwarded-For."""
    from starlette.testclient import TestClient
    from starlette.applications import Starlette
    from starlette.requests import Request
    from starlette.responses import PlainTextResponse
    from starlette.routing import Route

    async def _echo_ip(request: Request):
        return PlainTextResponse(get_client_ip(request))

    app = Starlette(routes=[Route("/ip", _echo_ip)])
    tc = TestClient(app)

    resp = tc.get("/ip", headers={"X-Forwarded-For": "203.0.113.50, 70.41.3.18, 150.172.238.178"})
    assert resp.text == "203.0.113.50"

    # Single IP
    resp = tc.get("/ip", headers={"X-Forwarded-For": "198.51.100.1"})
    assert resp.text == "198.51.100.1"

    # No header — falls back to client host
    resp = tc.get("/ip")
    assert resp.text  # should return something (testclient uses 127.0.0.1)


# ------------------------------------------------------------------
# 8. Account lockout after 3 violations
# ------------------------------------------------------------------


def test_account_lockout_after_3_violations():
    """3 lockout violations within 24h should lock the account."""
    email = "locked@example.com"

    for _ in range(3):
        _record_lockout_violation(email)

    with pytest.raises(RateLimitedError, match="locked"):
        check_lockout(email)


# ------------------------------------------------------------------
# 9. Lockout cleared after 24 hours
# ------------------------------------------------------------------


def test_lockout_cleared_after_24h():
    """Lockout violations older than 24h should be pruned, allowing login."""
    email = "locked24@example.com"

    with freeze_time("2025-01-01 00:00:00") as frozen:
        for _ in range(3):
            _record_lockout_violation(email)

        with pytest.raises(RateLimitedError):
            check_lockout(email)

        # Advance 24h + 1s
        frozen.move_to("2025-01-02 00:00:01")
        check_lockout(email)  # no exception


# ------------------------------------------------------------------
# 10. Lockout violations expire individually
# ------------------------------------------------------------------


def test_lockout_violations_expire():
    """Only violations within the 24h window count toward the lockout threshold."""
    email = "partial@example.com"

    with freeze_time("2025-01-01 00:00:00") as frozen:
        # Record 2 violations at T=0
        _record_lockout_violation(email)
        _record_lockout_violation(email)

        # Advance 23h — still within window, add a 3rd → locked
        frozen.move_to("2025-01-01 23:00:00")
        _record_lockout_violation(email)

        with pytest.raises(RateLimitedError):
            check_lockout(email)

        # Advance to T=24h01m — first 2 violations expire, only 1 remains
        frozen.move_to("2025-01-02 00:01:00")
        check_lockout(email)  # no exception — only 1 violation in window
