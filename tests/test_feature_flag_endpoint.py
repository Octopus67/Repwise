"""Unit tests for the GET /api/v1/feature-flags/check/{flag_name} endpoint.

Three tests:
1. Authenticated request for non-existent flag → {"enabled": false}
2. Unauthenticated request → 401
3. Existing enabled flag → {"enabled": true}

Requirements: 1.1, 1.2
"""

from __future__ import annotations

import pytest

from src.modules.feature_flags.service import FeatureFlagService, invalidate_cache


@pytest.mark.asyncio
async def test_nonexistent_flag_returns_enabled_false(client, override_get_db, db_session):
    """Authenticated request for a flag that doesn't exist → {"enabled": false}."""
    invalidate_cache()

    # Register a user to get a valid JWT
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "flagcheck@example.com", "password": "securepass123"},
    )
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Check a flag that was never created
    resp = await client.get(
        "/api/v1/feature-flags/check/totally_nonexistent_flag",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json() == {"enabled": False}


@pytest.mark.asyncio
async def test_unauthenticated_request_returns_401(client, override_get_db):
    """Request without Authorization header → 401."""
    resp = await client.get("/api/v1/feature-flags/check/any_flag")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_existing_enabled_flag_returns_enabled_true(client, override_get_db, db_session):
    """Enabled flag with no conditions → {"enabled": true} for any authenticated user."""
    invalidate_cache()

    # Seed the flag as enabled (no conditions → enabled for everyone)
    service = FeatureFlagService(db_session)
    await service.set_flag(
        "camera_barcode_scanner",
        is_enabled=True,
        conditions=None,
        description="Test flag for camera barcode scanner",
    )
    await db_session.commit()
    invalidate_cache()

    # Register a user to get a valid JWT
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "flagenabled@example.com", "password": "securepass123"},
    )
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get(
        "/api/v1/feature-flags/check/camera_barcode_scanner",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json() == {"enabled": True}
