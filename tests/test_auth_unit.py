"""Unit tests for the auth module — task 2.4.

Validates: Requirements 1.1, 1.4, 1.5, 1.7, 1.8
"""

import pytest

from src.middleware.rate_limiter import clear_all, record_attempt
from src.config.settings import settings


@pytest.fixture(autouse=True)
def _clear_rate_limiter():
    """Reset rate limiter state before each test."""
    clear_all()
    yield
    clear_all()


# ------------------------------------------------------------------
# 1. Email registration happy path
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_register_email_happy_path(client, override_get_db):
    """POST /register with valid email/password → 201, returns tokens."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "new@example.com", "password": "securepass123"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert "expires_in" in body
    assert body["token_type"] == "bearer"


# ------------------------------------------------------------------
# 2. Duplicate email registration
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_register_duplicate_email(client, override_get_db):
    """Register same email twice → second returns 409 Conflict."""
    payload = {"email": "dup@example.com", "password": "securepass123"}
    first = await client.post("/api/v1/auth/register", json=payload)
    assert first.status_code == 201

    second = await client.post("/api/v1/auth/register", json=payload)
    assert second.status_code == 409


# ------------------------------------------------------------------
# 3. Login with correct credentials
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_login_correct_credentials(client, override_get_db):
    """Register, then POST /login → 200, returns tokens."""
    creds = {"email": "login@example.com", "password": "securepass123"}
    await client.post("/api/v1/auth/register", json=creds)

    resp = await client.post("/api/v1/auth/login", json=creds)
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"


# ------------------------------------------------------------------
# 4. Login with incorrect password
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_login_incorrect_password(client, override_get_db):
    """POST /login with wrong password → 401."""
    creds = {"email": "wrongpw@example.com", "password": "securepass123"}
    await client.post("/api/v1/auth/register", json=creds)

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "wrongpw@example.com", "password": "wrongpassword"},
    )
    assert resp.status_code == 401


# ------------------------------------------------------------------
# 5. Login with non-existent email
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_login_nonexistent_email(client, override_get_db):
    """POST /login with unknown email → 401."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "doesntmatter"},
    )
    assert resp.status_code == 401


# ------------------------------------------------------------------
# 6. Token refresh with valid refresh token
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_refresh_valid_token(client, override_get_db):
    """Register, extract refresh_token, POST /refresh → 200, new tokens."""
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "refresh@example.com", "password": "securepass123"},
    )
    refresh_tok = reg.json()["refresh_token"]

    resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_tok},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body


# ------------------------------------------------------------------
# 7. Token refresh with invalid token
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_refresh_invalid_token(client, override_get_db):
    """POST /refresh with garbage token → 401."""
    resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "not-a-real-token"},
    )
    assert resp.status_code == 401


# ------------------------------------------------------------------
# 8. Rate limiting after threshold exceeded
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rate_limiting_after_threshold(client, override_get_db):
    """Make LOGIN_RATE_LIMIT_THRESHOLD failed attempts, then verify 429."""
    email = "ratelimit@example.com"
    bad_creds = {"email": email, "password": "wrongpassword"}

    # Exhaust the threshold with failed login attempts
    for _ in range(settings.LOGIN_RATE_LIMIT_THRESHOLD):
        resp = await client.post("/api/v1/auth/login", json=bad_creds)
        assert resp.status_code == 401

    # Next attempt should be rate-limited
    resp = await client.post("/api/v1/auth/login", json=bad_creds)
    assert resp.status_code == 429
