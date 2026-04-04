"""Unit tests for the auth module — task 2.4.

Validates: Requirements 1.1, 1.4, 1.5, 1.7, 1.8
"""

import pytest

from src.middleware.rate_limiter import clear_all, record_attempt
from src.modules.auth.router import clear_verify_attempts
from src.config.settings import settings
from unittest.mock import MagicMock, patch


@pytest.fixture(autouse=True)
def _clear_rate_limiter():
    """Reset rate limiter state before each test."""
    clear_all()
    clear_verify_attempts()
    yield
    clear_all()
    clear_verify_attempts()


@pytest.fixture
def mock_ses():
    """Mock SES client to avoid real AWS calls."""
    with patch("src.services.email_service._get_ses_client") as mock:
        client = MagicMock()
        client.send_email.return_value = {"MessageId": "test-id"}
        mock.return_value = client
        yield client


# ------------------------------------------------------------------
# 1. Email registration happy path
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_register_email_happy_path(client, override_get_db, mock_ses):
    """POST /register with valid email/password → 201, returns tokens."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "new@example.com", "password": "SecurePass123"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["access_token"] is not None
    assert body["refresh_token"] is not None
    assert body["expires_in"] is not None
    assert body["token_type"] == "bearer"
    assert "message" in body


# ------------------------------------------------------------------
# 2. Duplicate email registration
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_register_duplicate_email(client, override_get_db, mock_ses):
    """Register same email twice → second returns 201 with generic message, no tokens."""
    payload = {"email": "dup@example.com", "password": "SecurePass123"}
    first = await client.post("/api/v1/auth/register", json=payload)
    assert first.status_code == 201

    second = await client.post("/api/v1/auth/register", json=payload)
    assert second.status_code == 201
    body = second.json()
    # Should return generic message without tokens to prevent enumeration
    assert body["access_token"] is None
    assert body["refresh_token"] is None
    assert body["expires_in"] is None
    assert "message" in body


# ------------------------------------------------------------------
# 3. Login with correct credentials
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_login_correct_credentials(client, override_get_db, db_session, mock_ses):
    """Register, verify email, then POST /login → 200, returns tokens."""
    creds = {"email": "login@example.com", "password": "SecurePass123"}
    await client.post("/api/v1/auth/register", json=creds)

    # Mark email as verified so login succeeds
    from sqlalchemy import select
    from src.modules.auth.models import User
    stmt = select(User).where(User.email == "login@example.com")
    result = await db_session.execute(stmt)
    user = result.scalar_one()
    user.email_verified = True
    await db_session.commit()

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
async def test_login_incorrect_password(client, override_get_db, mock_ses):
    """POST /login with wrong password → 401."""
    creds = {"email": "wrongpw@example.com", "password": "SecurePass123"}
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
async def test_login_nonexistent_email(client, override_get_db, mock_ses):
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
async def test_refresh_valid_token(client, override_get_db, mock_ses):
    """Register, extract refresh_token, POST /refresh → 200, new tokens."""
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "refresh@example.com", "password": "SecurePass123"},
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
async def test_refresh_invalid_token(client, override_get_db, mock_ses):
    """POST /refresh with garbage token → 401."""
    resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "not-a-real-token"},
    )
    assert resp.status_code == 401


# ------------------------------------------------------------------
# 8. Apple OAuth — verifies token and creates/finds user
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_apple_oauth_happy_path(client, override_get_db, monkeypatch, mock_ses):
    """POST /oauth/apple with valid token → 200, returns tokens and creates user."""
    import jwt as pyjwt
    from unittest.mock import MagicMock

    monkeypatch.setattr(settings, "APPLE_CLIENT_ID", "com.octopuslabs.repwise")

    fake_key = MagicMock()
    decoded_payload = {
        "sub": "apple-user-001",
        "email": "user@example.com",
        "iss": "https://appleid.apple.com",
        "aud": "com.octopuslabs.repwise",
    }

    def mock_get_signing_key(token):
        return fake_key

    def mock_decode(token, key, **kwargs):
        return decoded_payload

    monkeypatch.setattr(
        "src.modules.auth.service._apple_jwk_client.get_signing_key_from_jwt",
        mock_get_signing_key,
    )
    monkeypatch.setattr("src.modules.auth.service.pyjwt.decode", mock_decode)

    resp = await client.post(
        "/api/v1/auth/oauth/apple",
        json={"provider": "apple", "token": "valid-apple-token"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_apple_oauth_invalid_token(client, override_get_db, monkeypatch, mock_ses):
    """POST /oauth/apple with invalid token → 401."""
    import jwt as pyjwt
    from unittest.mock import MagicMock

    monkeypatch.setattr(settings, "APPLE_CLIENT_ID", "com.octopuslabs.repwise")

    def mock_get_signing_key(token):
        raise pyjwt.InvalidTokenError("bad key")

    monkeypatch.setattr(
        "src.modules.auth.service._apple_jwk_client.get_signing_key_from_jwt",
        mock_get_signing_key,
    )

    resp = await client.post(
        "/api/v1/auth/oauth/apple",
        json={"provider": "apple", "token": "invalid-token"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_apple_oauth_not_configured(client, override_get_db, monkeypatch, mock_ses):
    """POST /oauth/apple when APPLE_CLIENT_ID is empty → 401."""
    monkeypatch.setattr(settings, "APPLE_CLIENT_ID", "")

    resp = await client.post(
        "/api/v1/auth/oauth/apple",
        json={"provider": "apple", "token": "any-token"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_apple_oauth_privacy_relay_email(client, override_get_db, monkeypatch, mock_ses):
    """Apple user with no email gets a privaterelay fallback."""
    from unittest.mock import MagicMock

    monkeypatch.setattr(settings, "APPLE_CLIENT_ID", "com.octopuslabs.repwise")

    fake_key = MagicMock()
    decoded_payload = {
        "sub": "apple-user-no-email",
        "iss": "https://appleid.apple.com",
        "aud": "com.octopuslabs.repwise",
    }

    monkeypatch.setattr(
        "src.modules.auth.service._apple_jwk_client.get_signing_key_from_jwt",
        lambda t: fake_key,
    )
    monkeypatch.setattr(
        "src.modules.auth.service.pyjwt.decode",
        lambda token, key, **kw: decoded_payload,
    )

    resp = await client.post(
        "/api/v1/auth/oauth/apple",
        json={"provider": "apple", "token": "valid-apple-token"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body


@pytest.mark.asyncio
async def test_apple_oauth_existing_user(client, override_get_db, monkeypatch, mock_ses):
    """Second Apple login with same sub returns tokens without creating duplicate."""
    from unittest.mock import MagicMock

    monkeypatch.setattr(settings, "APPLE_CLIENT_ID", "com.octopuslabs.repwise")

    fake_key = MagicMock()
    decoded_payload = {
        "sub": "apple-returning-user",
        "email": "returning@example.com",
        "iss": "https://appleid.apple.com",
        "aud": "com.octopuslabs.repwise",
    }

    monkeypatch.setattr(
        "src.modules.auth.service._apple_jwk_client.get_signing_key_from_jwt",
        lambda t: fake_key,
    )
    monkeypatch.setattr(
        "src.modules.auth.service.pyjwt.decode",
        lambda token, key, **kw: decoded_payload,
    )

    # First login — creates user
    resp1 = await client.post(
        "/api/v1/auth/oauth/apple",
        json={"provider": "apple", "token": "token1"},
    )
    assert resp1.status_code == 200

    # Second login — finds existing user
    resp2 = await client.post(
        "/api/v1/auth/oauth/apple",
        json={"provider": "apple", "token": "token2"},
    )
    assert resp2.status_code == 200
    assert resp2.json()["access_token"] != resp1.json()["access_token"]


# ------------------------------------------------------------------
# 9. Rate limiting after threshold exceeded
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rate_limiting_after_threshold(client, override_get_db, mock_ses):
    """Make failed attempts until rate-limited, then verify 429."""
    email = "ratelimit@example.com"
    bad_creds = {"email": email, "password": "wrongpassword"}

    # The lockout threshold (3 per 24h) is lower than the login threshold (5 per 15min),
    # so we expect 429 after 3 failed attempts (lockout kicks in first).
    for i in range(3):
        resp = await client.post("/api/v1/auth/login", json=bad_creds)
        assert resp.status_code == 401, f"Attempt {i+1} expected 401, got {resp.status_code}"

    # Next attempt should be rate-limited by lockout
    resp = await client.post("/api/v1/auth/login", json=bad_creds)
    assert resp.status_code == 429


# ------------------------------------------------------------------
# 10. Login with unverified email succeeds with email_verified=false (C2 deferrable)
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_login_unverified_email_succeeds_with_flag(client, override_get_db, mock_ses):
    """POST /login with correct creds but unverified email → 200 with email_verified=false."""
    creds = {"email": "unverified@example.com", "password": "SecurePass123"}
    await client.post("/api/v1/auth/register", json=creds)

    resp = await client.post("/api/v1/auth/login", json=creds)
    assert resp.status_code == 200
    body = resp.json()
    assert body["email_verified"] is False
    assert "access_token" in body


# ------------------------------------------------------------------
# 11. Verify-email rate limiting (5 attempts per 15 min)
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_verify_email_rate_limited(client, override_get_db, db_session, mock_ses):
    """Exceed 5 verify-email attempts → 429."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "ratelimitverify@example.com", "password": "SecurePass123"},
    )
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Mock the rate limiter to actually enforce limits without Redis
    call_count = 0

    def _mock_check(user_id, endpoint, max_attempts, window_seconds):
        nonlocal call_count
        call_count += 1
        if call_count > max_attempts:
            from src.shared.errors import RateLimitedError
            raise RateLimitedError(message="Too many requests", retry_after=window_seconds)

    with patch("src.modules.auth.router.check_user_endpoint_rate_limit", side_effect=_mock_check):
        # 5 attempts should succeed (returning 400 for bad code, not 429)
        for _ in range(5):
            r = await client.post(
                "/api/v1/auth/verify-email",
                json={"code": "000000"},
                headers=headers,
            )
            assert r.status_code == 400

        # 6th attempt should be rate-limited
        r = await client.post(
            "/api/v1/auth/verify-email",
            json={"code": "000000"},
            headers=headers,
        )
        assert r.status_code == 429


# ------------------------------------------------------------------
# 12. Apple OAuth accepts identity_token field
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_apple_oauth_identity_token_field(client, override_get_db, monkeypatch, mock_ses):
    """POST /oauth/apple with identity_token field → 200."""
    import jwt as pyjwt
    from unittest.mock import MagicMock

    monkeypatch.setattr(settings, "APPLE_CLIENT_ID", "com.octopuslabs.repwise")

    fake_key = MagicMock()
    decoded_payload = {
        "sub": "apple-identity-token-user",
        "email": "identity@example.com",
        "iss": "https://appleid.apple.com",
        "aud": "com.octopuslabs.repwise",
    }

    monkeypatch.setattr(
        "src.modules.auth.service._apple_jwk_client.get_signing_key_from_jwt",
        lambda t: fake_key,
    )
    monkeypatch.setattr(
        "src.modules.auth.service.pyjwt.decode",
        lambda token, key, **kw: decoded_payload,
    )

    resp = await client.post(
        "/api/v1/auth/oauth/apple",
        json={"provider": "apple", "identity_token": "valid-apple-identity-token"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body


# ------------------------------------------------------------------
# 13. Register duplicate sends account-exists email
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_register_duplicate_sends_account_exists_email(client, override_get_db, mock_ses):
    """Register same email twice → second call sends account-exists notification."""
    payload = {"email": "exists@example.com", "password": "SecurePass123"}
    await client.post("/api/v1/auth/register", json=payload)
    mock_ses.send_email.reset_mock()

    await client.post("/api/v1/auth/register", json=payload)
    # Should have sent an account-exists notification email
    assert mock_ses.send_email.called
    call_args = mock_ses.send_email.call_args
    assert "already exists" in call_args[1]["Message"]["Body"]["Text"]["Data"]


# ------------------------------------------------------------------
# 14. Error responses use message field (not detail)
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_error_responses_have_message_field(client, override_get_db, mock_ses):
    """Error responses should use 'message' field, not 'detail'."""
    # Bad reset code
    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"email": "nobody@example.com", "code": "000000", "new_password": "NewSecure1"},
    )
    assert resp.status_code == 400
    body = resp.json()
    assert "message" in body
    assert "detail" not in body
