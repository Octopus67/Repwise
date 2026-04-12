"""F1: Auth flow E2E tests — register, login, password reset, token lifecycle."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.e2e.conftest import register_user
from tests.e2e.factories import make_user_credentials


class TestRegisterFlow:
    """F1.1–F1.3: Registration flows."""

    @pytest.mark.asyncio
    async def test_register_and_login(self, client: AsyncClient, override_get_db):
        """F1.1: Register → login → access protected route."""
        creds = make_user_credentials()
        # Register
        resp = await client.post("/api/v1/auth/register", json=creds)
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data

        # Login with same creds
        resp = await client.post("/api/v1/auth/login", json=creds)
        assert resp.status_code == 200
        token = resp.json()["access_token"]

        # Access protected route
        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["email"] == creds["email"]

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client: AsyncClient, override_get_db):
        """F1.3: Register same email twice → second returns 201 but no token (silent)."""
        creds = make_user_credentials()
        resp1 = await client.post("/api/v1/auth/register", json=creds)
        assert resp1.status_code == 201
        resp2 = await client.post("/api/v1/auth/register", json=creds)
        # App returns 201 with message but no tokens (prevents enumeration)
        assert resp2.status_code == 201
        data = resp2.json()
        assert data.get("access_token") is None or "message" in data

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "bad_password,expected_msg",
        [
            ("short1!", "at least 8 characters"),
            ("alllowercase1!", "uppercase"),
            ("ALLUPPERCASE1!", "lowercase"),
            ("NoDigitsHere!", "digit"),
            ("NoSpecial1Char", "special character"),
        ],
    )
    async def test_register_password_rules(
        self, client: AsyncClient, override_get_db, bad_password, expected_msg
    ):
        """F1.13: Each password rule violation returns specific error."""
        creds = make_user_credentials(password=bad_password)
        resp = await client.post("/api/v1/auth/register", json=creds)
        assert resp.status_code == 400
        detail = resp.json()
        assert expected_msg.lower() in str(detail).lower()


class TestLoginFlow:
    """F1.4–F1.5: Login edge cases."""

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, override_get_db):
        """F1.4: Login with wrong password → 401."""
        creds = make_user_credentials()
        await client.post("/api/v1/auth/register", json=creds)
        resp = await client.post(
            "/api/v1/auth/login", json={"email": creds["email"], "password": "WrongPass1!"}
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_login_nonexistent_email(self, client: AsyncClient, override_get_db):
        """F1.5: Login with non-existent email → 401."""
        resp = await client.post(
            "/api/v1/auth/login", json={"email": "nobody@test.com", "password": "Pass1234!"}
        )
        assert resp.status_code == 401


class TestTokenLifecycle:
    """F1.9–F1.14: Token refresh, blacklist, expiry."""

    @pytest.mark.asyncio
    async def test_refresh_token(self, client: AsyncClient, override_get_db):
        """F1.9: Refresh token → get new access token."""
        user = await register_user(client)
        resp = await client.post(
            "/api/v1/auth/refresh", json={"refresh_token": user["refresh_token"]}
        )
        assert resp.status_code == 200
        new_data = resp.json()
        assert "access_token" in new_data
        # New token works
        resp = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {new_data['access_token']}"}
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_logout_blacklists_token(self, client: AsyncClient, override_get_db):
        """F1.14: Logout → token blacklisted → can't reuse."""
        user = await register_user(client)
        headers = {"Authorization": f"Bearer {user['access_token']}"}
        # Logout
        resp = await client.post(
            "/api/v1/auth/logout", headers=headers, json={"refresh_token": user["refresh_token"]}
        )
        assert resp.status_code in (200, 204)
        # Token should be blacklisted — refresh should fail
        resp = await client.post(
            "/api/v1/auth/refresh", json={"refresh_token": user["refresh_token"]}
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_no_token_returns_401(self, client: AsyncClient, override_get_db):
        """F1.11: Access protected route without token → 401."""
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_invalid_token_returns_401(self, client: AsyncClient, override_get_db):
        """F1.12: Access with garbage token → 401."""
        resp = await client.get(
            "/api/v1/auth/me", headers={"Authorization": "Bearer garbage.token.here"}
        )
        assert resp.status_code in (401, 403)


class TestForgotPasswordFlow:
    """F1.6–F1.8: Password reset flow."""

    @pytest.mark.asyncio
    async def test_forgot_password_returns_200_always(self, client: AsyncClient, override_get_db):
        """F1.6: Forgot password always returns 200 (no enumeration)."""
        # Non-existent email
        resp = await client.post("/api/v1/auth/forgot-password", json={"email": "nobody@test.com"})
        assert resp.status_code == 200
        # Existing email
        user = await register_user(client)
        resp = await client.post("/api/v1/auth/forgot-password", json={"email": user["email"]})
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_reset_password_with_wrong_code(self, client: AsyncClient, override_get_db):
        """F1.7: Reset with wrong code → fails."""
        user = await register_user(client)
        await client.post("/api/v1/auth/forgot-password", json={"email": user["email"]})
        resp = await client.post(
            "/api/v1/auth/reset-password",
            json={
                "email": user["email"],
                "code": "000000",
                "new_password": "NewPass1!xyz",
            },
        )
        assert resp.status_code in (400, 401)
