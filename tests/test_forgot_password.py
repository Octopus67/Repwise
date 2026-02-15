"""Tests for forgot-password and reset-password endpoints — Task 8.5."""

import time

import pytest

from src.config.settings import settings
from src.modules.auth.service import _reset_tokens


@pytest.fixture(autouse=True)
def _enable_debug_and_cleanup():
    """Enable DEBUG so dev_token is returned, and clean up reset tokens."""
    original = settings.DEBUG
    settings.DEBUG = True
    _reset_tokens.clear()
    yield
    settings.DEBUG = original
    _reset_tokens.clear()


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

async def _register_user(client, email="forgot@example.com", password="securepass123"):
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 201
    return resp.json()


async def _forgot_password(client, email="forgot@example.com"):
    resp = await client.post(
        "/api/v1/auth/forgot-password",
        json={"email": email},
    )
    return resp


# ------------------------------------------------------------------
# 1. Forgot password returns 200 for existing email
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_forgot_password_returns_200_for_existing_email(client, override_get_db):
    await _register_user(client)
    resp = await _forgot_password(client)
    assert resp.status_code == 200
    body = resp.json()
    assert "message" in body
    assert "dev_token" in body
    assert body["dev_token"] is not None


# ------------------------------------------------------------------
# 2. Forgot password returns 200 for nonexistent email
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_forgot_password_returns_200_for_nonexistent_email(client, override_get_db):
    resp = await _forgot_password(client, email="nobody@example.com")
    assert resp.status_code == 200
    body = resp.json()
    assert "message" in body
    assert "dev_token" not in body


# ------------------------------------------------------------------
# 3. Reset password with valid token
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_reset_password_with_valid_token(client, override_get_db):
    await _register_user(client)
    forgot_resp = await _forgot_password(client)
    token = forgot_resp.json()["dev_token"]

    new_password = "newSecurePass456"
    reset_resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": new_password},
    )
    assert reset_resp.status_code == 200
    assert reset_resp.json()["message"] == "Password has been reset"

    # Verify login with new password works
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "forgot@example.com", "password": new_password},
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()


# ------------------------------------------------------------------
# 4. Reset password with invalid token
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_reset_password_with_invalid_token(client, override_get_db):
    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "garbage-token-12345", "new_password": "validpass123"},
    )
    assert resp.status_code == 400
    assert "Invalid or expired" in resp.json()["detail"]


# ------------------------------------------------------------------
# 5. Reset password with expired token
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_reset_password_with_expired_token(client, override_get_db):
    await _register_user(client)
    forgot_resp = await _forgot_password(client)
    token = forgot_resp.json()["dev_token"]

    # Manually expire the token
    email, _ = _reset_tokens[token]
    _reset_tokens[token] = (email, time.time() - 1)

    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "newSecurePass456"},
    )
    assert resp.status_code == 400
    assert "Invalid or expired" in resp.json()["detail"]


# ------------------------------------------------------------------
# 6. Reset password token is single-use
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_reset_password_token_single_use(client, override_get_db):
    await _register_user(client)
    forgot_resp = await _forgot_password(client)
    token = forgot_resp.json()["dev_token"]

    # First use — success
    resp1 = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "firstNewPass123"},
    )
    assert resp1.status_code == 200

    # Second use — should fail
    resp2 = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "secondNewPass456"},
    )
    assert resp2.status_code == 400


# ------------------------------------------------------------------
# 7. Reset password validates minimum length
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_reset_password_validates_min_length(client, override_get_db):
    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "any-token", "new_password": "abc"},
    )
    # Custom validation handler returns 400 instead of default 422
    assert resp.status_code == 400
    body = resp.json()
    assert body["code"] == "VALIDATION_ERROR"
