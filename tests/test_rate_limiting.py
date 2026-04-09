# Audit fix 5.1 — rate limiting tests
"""Rate limiting tests — Redis-backed with in-memory fallback (no Redis needed)."""

import pytest
from freezegun import freeze_time
from sqlalchemy import select, func

from src.middleware.db_rate_limiter import check_db_rate_limit, record_db_attempt, reset_db_attempts
from src.middleware.rate_limit_models import RateLimitEntry
from src.middleware.rate_limiter import (
    check_login_ip_rate_limit,
    check_lockout,
    check_register_rate_limit,
    check_forgot_password_rate_limit,
    check_rate_limit,
    clear_all,
    record_attempt,
    _memory_record,
)
from src.shared.errors import RateLimitedError
from src.shared.ip_utils import get_client_ip


@pytest.fixture(autouse=True)
def _clear_rate_limiter():
    clear_all()
    yield
    clear_all()


# --- DB rate limiter tests ---


@pytest.mark.asyncio
async def test_db_rate_limiter_check_without_record(db_session):
    """No prior attempts → no block."""
    await check_db_rate_limit(
        session=db_session,
        key="user@example.com",
        endpoint="login",
        max_attempts=5,
        window_seconds=900,
        message="blocked",
    )


@pytest.mark.asyncio
async def test_db_rate_limiter_record_on_failure(db_session):
    """Exceeding max attempts raises RateLimitedError."""
    key, endpoint = "user@example.com", "login"
    for _ in range(3):
        await record_db_attempt(db_session, key=key, endpoint=endpoint)
    await db_session.flush()

    count = (
        await db_session.execute(
            select(func.count())
            .select_from(RateLimitEntry)
            .where(
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


@pytest.mark.asyncio
async def test_db_rate_limiter_reset_on_success(db_session):
    """reset_db_attempts clears entries, unblocking the user."""
    key, endpoint = "user@example.com", "login"
    for _ in range(5):
        await record_db_attempt(db_session, key=key, endpoint=endpoint)
    await db_session.flush()
    await reset_db_attempts(db_session, key=key, endpoint=endpoint)
    await check_db_rate_limit(
        session=db_session,
        key=key,
        endpoint=endpoint,
        max_attempts=5,
        window_seconds=900,
        message="blocked",
    )


@pytest.mark.asyncio
async def test_registration_db_rate_limiting(db_session):
    """Registration blocks after 5 attempts per IP in 1 hour."""
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


# --- In-memory fallback tests (Redis unavailable, REDIS_URL="" in tests) ---


@pytest.mark.asyncio
async def test_login_ip_rate_limiting():
    """20 login attempts from one IP triggers a block."""
    ip = "10.0.0.1"
    for _ in range(20):
        _memory_record("login_ip", ip, 900)
    with pytest.raises(RateLimitedError):
        await check_login_ip_rate_limit(ip)


@pytest.mark.asyncio
async def test_login_rate_limit_too_many_failures():
    """Exceeding login threshold blocks further attempts."""
    from src.config.settings import settings

    email = "brute@example.com"
    for _ in range(settings.LOGIN_RATE_LIMIT_THRESHOLD):
        await record_attempt(email)
    with pytest.raises(RateLimitedError, match="login"):
        await check_rate_limit(email)


@pytest.mark.asyncio
async def test_forgot_password_rate_limit():
    """3 forgot-password requests triggers a block."""
    email = "forgot@example.com"
    for _ in range(3):
        _memory_record("forgot_password", email, 900)
    with pytest.raises(RateLimitedError, match="password reset"):
        await check_forgot_password_rate_limit(email)


@pytest.mark.asyncio
async def test_register_rate_limit():
    """5 registration attempts per IP triggers a block."""
    ip = "192.168.1.1"
    for _ in range(5):
        _memory_record("register", ip, 3600)
    with pytest.raises(RateLimitedError, match="registration"):
        await check_register_rate_limit(ip)


@pytest.mark.asyncio
async def test_account_lockout_after_repeated_failures():
    """3 lockout violations within 24h locks the account."""
    email = "locked@example.com"
    for _ in range(3):
        _memory_record("lockout", email, 86400)
    with pytest.raises(RateLimitedError, match="locked"):
        await check_lockout(email)


@pytest.mark.asyncio
async def test_rate_limit_reset_after_window():
    """Entries older than the window are pruned, allowing new attempts."""
    email = "window@example.com"
    with freeze_time("2025-01-01 00:00:00") as frozen:
        for _ in range(3):
            _memory_record("forgot_password", email, 900)
        with pytest.raises(RateLimitedError):
            await check_forgot_password_rate_limit(email)
        frozen.move_to("2025-01-01 00:15:01")
        await check_forgot_password_rate_limit(email)  # no exception


@pytest.mark.asyncio
async def test_in_memory_fallback_when_redis_unavailable():
    """Auth-critical rate limiting works via in-memory fallback (no Redis)."""
    ip = "10.0.0.99"
    for _ in range(20):
        _memory_record("login_ip", ip, 900)
    with pytest.raises(RateLimitedError):
        await check_login_ip_rate_limit(ip)
    clear_all()
    await check_login_ip_rate_limit(ip)  # no exception after clear


# --- IP extraction ---


def test_ip_extraction_from_xff():
    """get_client_ip returns the first IP from X-Forwarded-For."""
    from starlette.testclient import TestClient
    from starlette.applications import Starlette
    from starlette.requests import Request
    from starlette.responses import PlainTextResponse
    from starlette.routing import Route

    async def _echo_ip(request: Request):
        return PlainTextResponse(get_client_ip(request))

    app = Starlette(routes=[Route("/ip", _echo_ip)])
    tc = TestClient(app)
    resp = tc.get("/ip", headers={"X-Forwarded-For": "203.0.113.50, 70.41.3.18"})
    assert resp.text == "203.0.113.50"
    resp = tc.get("/ip")
    assert resp.text  # falls back to client host
