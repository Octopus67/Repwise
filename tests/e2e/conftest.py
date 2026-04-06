"""E2E test fixtures — auth helpers and authenticated client."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.e2e.factories import make_user_credentials


@pytest.fixture
async def auth_client(client: AsyncClient, override_get_db) -> AsyncClient:
    """Return an authenticated AsyncClient with a registered user's token."""
    creds = make_user_credentials()
    resp = await client.post("/api/v1/auth/register", json=creds)
    assert resp.status_code in (200, 201), f"Register failed: {resp.text}"
    token = resp.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client


@pytest.fixture
async def auth_pair(client: AsyncClient, override_get_db):
    """Return (client, creds) so tests can access email/password."""
    creds = make_user_credentials()
    resp = await client.post("/api/v1/auth/register", json=creds)
    assert resp.status_code in (200, 201), f"Register failed: {resp.text}"
    data = resp.json()
    client.headers["Authorization"] = f"Bearer {data['access_token']}"
    return client, {**creds, **data}


async def register_user(client: AsyncClient, **overrides) -> dict:
    """Register a user and return {email, password, access_token, refresh_token}."""
    creds = make_user_credentials(**overrides)
    resp = await client.post("/api/v1/auth/register", json=creds)
    assert resp.status_code in (200, 201), f"Register failed: {resp.text}"
    return {**creds, **resp.json()}


async def login_user(client: AsyncClient, email: str, password: str) -> dict:
    """Login and return token response."""
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json() if resp.status_code == 200 else {"status": resp.status_code, **resp.json()}
