"""Tests for forgot-password and reset-password endpoints — Task 8.5."""

import pytest
from unittest.mock import patch, MagicMock

from src.config.settings import settings


@pytest.fixture(autouse=True)
def _enable_debug():
    """Enable DEBUG so dev_token is returned."""
    original = settings.DEBUG
    settings.DEBUG = True
    yield
    settings.DEBUG = original


@pytest.fixture
def mock_ses():
    """Mock SES client to avoid real AWS calls."""
    with patch("src.services.email_service._get_ses_client") as mock:
        client = MagicMock()
        client.send_email.return_value = {"MessageId": "test-id"}
        mock.return_value = client
        yield client


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

KNOWN_OTP = "654321"


async def _register_user(client, email="forgot@example.com", password="SecurePass123!"):
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
async def test_forgot_password_returns_200_for_existing_email(client, override_get_db, mock_ses):
    await _register_user(client)
    resp = await _forgot_password(client)
    assert resp.status_code == 200
    body = resp.json()
    assert "message" in body


# ------------------------------------------------------------------
# 2. Forgot password returns 200 for nonexistent email
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_forgot_password_returns_200_for_nonexistent_email(client, override_get_db, mock_ses):
    resp = await _forgot_password(client, email="nobody@example.com")
    assert resp.status_code == 200
    body = resp.json()
    assert "message" in body


# ------------------------------------------------------------------
# 3. Reset password with valid OTP code
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_reset_password_with_valid_token(client, override_get_db, mock_ses):
    await _register_user(client)

    with patch("src.services.email_service.generate_otp", return_value=KNOWN_OTP):
        await _forgot_password(client)

    reset_resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"email": "forgot@example.com", "code": KNOWN_OTP, "new_password": "NewSecurePass456!"},
    )
    assert reset_resp.status_code == 200
    assert reset_resp.json()["message"] == "Password has been reset"

    # Verify login with new password works
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "forgot@example.com", "password": "NewSecurePass456!"},
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()


# ------------------------------------------------------------------
# 4. Reset password with invalid code
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_reset_password_with_invalid_token(client, override_get_db, mock_ses):
    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"email": "nobody@example.com", "code": "000000", "new_password": "ValidPass123!"},
    )
    assert resp.status_code == 400


# ------------------------------------------------------------------
# 5. Reset password code is single-use
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_reset_password_token_single_use(client, override_get_db, mock_ses):
    await _register_user(client)

    with patch("src.services.email_service.generate_otp", return_value=KNOWN_OTP):
        await _forgot_password(client)

    # First use — success
    resp1 = await client.post(
        "/api/v1/auth/reset-password",
        json={"email": "forgot@example.com", "code": KNOWN_OTP, "new_password": "FirstNewPass123!"},
    )
    assert resp1.status_code == 200

    # Second use — should fail
    resp2 = await client.post(
        "/api/v1/auth/reset-password",
        json={"email": "forgot@example.com", "code": KNOWN_OTP, "new_password": "SecondNewPass456!"},
    )
    assert resp2.status_code == 400

# ------------------------------------------------------------------
# 6. Reset password validates minimum length
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_reset_password_validates_min_length(client, override_get_db, mock_ses):
    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"email": "test@example.com", "code": "123456", "new_password": "abc"},
    )
    # Custom validation handler returns 400 instead of default 422
    assert resp.status_code == 400
    body = resp.json()
    assert body["code"] == "VALIDATION_ERROR"
