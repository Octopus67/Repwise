"""Property-based tests for the auth module.

Tests Properties 4, 18, and 24 from the design document using Hypothesis.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st
from jose import jwt

from src.config.settings import settings
from src.middleware.rate_limiter import clear_all as clear_rate_limits
from src.modules.auth.service import _generate_tokens


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Emails that are structurally invalid (missing @, no domain, etc.)
_malformed_emails = st.one_of(
    st.text(min_size=1, max_size=50).filter(lambda s: "@" not in s),
    st.just(""),
    st.just("@nodomain"),
    st.just("missing-at-sign.com"),
    st.just("user@"),
    st.just("user@.com"),
)

# Passwords that are too short (< 8 chars)
_short_passwords = st.text(min_size=0, max_size=7)


# ---------------------------------------------------------------------------
# Shared Hypothesis settings for tests using fixtures
# ---------------------------------------------------------------------------

_fixture_settings = h_settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _clear_rate_limits():
    """Reset rate-limit state between tests."""
    clear_rate_limits()
    yield
    clear_rate_limits()


# ---------------------------------------------------------------------------
# Property 4: Input validation rejects invalid data
# ---------------------------------------------------------------------------


class TestProperty4InputValidation:
    """Property 4: Input validation rejects invalid data.

    For any API request containing invalid field values (malformed email,
    short password, missing fields), the system SHALL reject the request
    with a 422 status code and SHALL NOT create any database records.
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(password=_short_passwords)
    async def test_short_password_rejected(
        self, password: str, client, override_get_db
    ):
        """Passwords shorter than 8 characters must be rejected.

        **Validates: Requirements 1.6, 14.2**
        """
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "test@example.com", "password": password},
        )
        assert response.status_code in (400, 422), (
            f"Expected 400 or 422 for password '{password}' (len={len(password)}), "
            f"got {response.status_code}"
        )

    @pytest.mark.asyncio
    @_fixture_settings
    @given(email=_malformed_emails)
    async def test_malformed_email_rejected(
        self, email: str, client, override_get_db
    ):
        """Malformed email addresses must be rejected.

        **Validates: Requirements 1.6, 14.2**
        """
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "validpassword123"},
        )
        assert response.status_code in (400, 422), (
            f"Expected 400 or 422 for email '{email}', got {response.status_code}"
        )

    @pytest.mark.asyncio
    async def test_missing_email_rejected(self, client, override_get_db):
        """Missing email field must be rejected.

        **Validates: Requirements 1.6, 14.2**
        """
        response = await client.post(
            "/api/v1/auth/register",
            json={"password": "validpassword123"},
        )
        assert response.status_code in (400, 422)

    @pytest.mark.asyncio
    async def test_missing_password_rejected(self, client, override_get_db):
        """Missing password field must be rejected.

        **Validates: Requirements 1.6, 14.2**
        """
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "test@example.com"},
        )
        assert response.status_code in (400, 422)

    @pytest.mark.asyncio
    async def test_empty_body_rejected(self, client, override_get_db):
        """Empty request body must be rejected.

        **Validates: Requirements 1.6, 14.2**
        """
        response = await client.post(
            "/api/v1/auth/register",
            json={},
        )
        assert response.status_code in (400, 422)


# ---------------------------------------------------------------------------
# Property 18: JWT authentication enforcement
# ---------------------------------------------------------------------------


class TestProperty18JWTEnforcement:
    """Property 18: JWT authentication enforcement.

    For any protected endpoint, a request without a valid JWT SHALL receive
    a 401 response. A request with a valid, non-expired JWT SHALL be processed.
    """

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client, override_get_db):
        """Request without Authorization header must get 401.

        **Validates: Requirements 16.1, 16.2**
        """
        response = await client.post("/api/v1/auth/logout")
        assert response.status_code == 401

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        random_string=st.text(
            alphabet=st.characters(whitelist_categories=("L", "N", "P", "S"),
                                   max_codepoint=127),
            min_size=1,
            max_size=200,
        )
    )
    async def test_invalid_token_returns_401(
        self, random_string: str, client, override_get_db
    ):
        """Random ASCII strings as Bearer tokens must get 401.

        **Validates: Requirements 16.1, 16.2**
        """
        response = await client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {random_string}"},
        )
        assert response.status_code == 401, (
            f"Expected 401 for random token, got {response.status_code}"
        )

    @pytest.mark.asyncio
    async def test_expired_token_returns_401(self, client, override_get_db):
        """An expired JWT must get 401.

        **Validates: Requirements 16.1, 16.2**
        """
        expired_payload = {
            "sub": str(uuid.uuid4()),
            "type": "access",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
            "iat": datetime.now(timezone.utc) - timedelta(hours=2),
        }
        expired_token = jwt.encode(
            expired_payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM
        )
        response = await client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_valid_token_accepted(self, client, override_get_db, db_session):
        """A valid JWT for an existing user must be accepted (204 on logout).

        **Validates: Requirements 16.1, 16.2**
        """
        # Register a user to get a valid token and create the user in the DB
        reg_resp = await client.post(
            "/api/v1/auth/register",
            json={"email": "jwt-test@example.com", "password": "securepass123"},
        )
        assert reg_resp.status_code == 201
        access_token = reg_resp.json()["access_token"]

        # Commit so the user is visible to subsequent queries
        await db_session.commit()

        # Use the valid token on the protected endpoint
        response = await client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_wrong_secret_returns_401(self, client, override_get_db):
        """A JWT signed with the wrong secret must get 401.

        **Validates: Requirements 16.1, 16.2**
        """
        payload = {
            "sub": str(uuid.uuid4()),
            "type": "access",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "iat": datetime.now(timezone.utc),
        }
        bad_token = jwt.encode(payload, "wrong-secret-key", algorithm="HS256")
        response = await client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {bad_token}"},
        )
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# Property 24: Token expiration configuration
# ---------------------------------------------------------------------------


class TestProperty24TokenExpiration:
    """Property 24: Token expiration configuration.

    For any issued JWT access token, its exp claim SHALL be set to
    current_time + configured_access_token_ttl (default 900s).
    For any issued refresh token, its exp claim SHALL be set to
    current_time + configured_refresh_token_ttl (default 604800s).
    """

    TOLERANCE_SECONDS = 5

    @h_settings(max_examples=50)
    @given(user_id=st.uuids())
    def test_access_token_expiration(self, user_id: uuid.UUID):
        """Access token exp must match configured TTL within tolerance.

        **Validates: Requirements 16.1, 16.2**
        """
        before = datetime.now(timezone.utc)
        tokens = _generate_tokens(user_id)
        after = datetime.now(timezone.utc)

        decoded = jwt.decode(
            tokens.access_token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )

        exp = datetime.fromtimestamp(decoded["exp"], tz=timezone.utc)
        expected_ttl = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

        earliest = before + expected_ttl - timedelta(seconds=self.TOLERANCE_SECONDS)
        latest = after + expected_ttl + timedelta(seconds=self.TOLERANCE_SECONDS)

        assert earliest <= exp <= latest, (
            f"Access token exp {exp} not within expected range "
            f"[{earliest}, {latest}] for TTL {expected_ttl}"
        )

    @h_settings(max_examples=50)
    @given(user_id=st.uuids())
    def test_refresh_token_expiration(self, user_id: uuid.UUID):
        """Refresh token exp must match configured TTL within tolerance.

        **Validates: Requirements 16.1, 16.2**
        """
        before = datetime.now(timezone.utc)
        tokens = _generate_tokens(user_id)
        after = datetime.now(timezone.utc)

        decoded = jwt.decode(
            tokens.refresh_token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )

        exp = datetime.fromtimestamp(decoded["exp"], tz=timezone.utc)
        expected_ttl = timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)

        earliest = before + expected_ttl - timedelta(seconds=self.TOLERANCE_SECONDS)
        latest = after + expected_ttl + timedelta(seconds=self.TOLERANCE_SECONDS)

        assert earliest <= exp <= latest, (
            f"Refresh token exp {exp} not within expected range "
            f"[{earliest}, {latest}] for TTL {expected_ttl}"
        )

    @h_settings(max_examples=50)
    @given(user_id=st.uuids())
    def test_access_token_type_claim(self, user_id: uuid.UUID):
        """Access token must have type='access' claim.

        **Validates: Requirements 16.1, 16.2**
        """
        tokens = _generate_tokens(user_id)
        decoded = jwt.decode(
            tokens.access_token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        assert decoded["type"] == "access"
        assert decoded["sub"] == str(user_id)

    @h_settings(max_examples=50)
    @given(user_id=st.uuids())
    def test_refresh_token_type_claim(self, user_id: uuid.UUID):
        """Refresh token must have type='refresh' claim.

        **Validates: Requirements 16.1, 16.2**
        """
        tokens = _generate_tokens(user_id)
        decoded = jwt.decode(
            tokens.refresh_token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        assert decoded["type"] == "refresh"
        assert decoded["sub"] == str(user_id)

    @h_settings(max_examples=50)
    @given(user_id=st.uuids())
    def test_expires_in_matches_access_ttl(self, user_id: uuid.UUID):
        """AuthTokens.expires_in must equal configured access TTL in seconds.

        **Validates: Requirements 16.1, 16.2**
        """
        tokens = _generate_tokens(user_id)
        expected_seconds = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        assert tokens.expires_in == expected_seconds
