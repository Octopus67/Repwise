"""Smoke test to verify E2E infrastructure works."""

import pytest


@pytest.mark.asyncio
async def test_e2e_infra_smoke(auth_client):
    """Verify auth_client fixture registers a user and returns authenticated client."""
    resp = await auth_client.get("/api/v1/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert "email" in data
    assert data["email"].startswith("e2e_")
