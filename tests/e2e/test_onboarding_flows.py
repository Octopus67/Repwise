"""E2E tests for the onboarding flow."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.e2e.conftest import register_user
from tests.e2e.factories import make_onboarding_payload
from tests.e2e.scenarios import ONBOARDING_SCENARIOS

ONBOARD_URL = "/api/v1/onboarding/complete"
REGISTER_URL = "/api/v1/auth/register"

MIN_CALORIES = 1200
MIN_CARBS = 50
MIN_FAT = 20


async def _register_and_onboard(client: AsyncClient, payload: dict) -> dict:
    """Register a fresh user, onboard, return response json."""
    user = await register_user(client)
    client.headers["Authorization"] = f"Bearer {user['access_token']}"
    resp = await client.post(ONBOARD_URL, json=payload)
    assert resp.status_code == 201, f"Onboard failed ({resp.status_code}): {resp.text}"
    return resp.json()


@pytest.mark.parametrize("payload", ONBOARDING_SCENARIOS)
@pytest.mark.asyncio
async def test_onboarding_scenario(payload: dict, client: AsyncClient, override_get_db):
    data = await _register_and_onboard(client, payload)
    snap = data["snapshot"]
    assert snap["target_calories"] > MIN_CALORIES
    assert snap["target_protein_g"] > 0
    assert snap["target_carbs_g"] >= MIN_CARBS
    assert snap["target_fat_g"] >= MIN_FAT


@pytest.mark.asyncio
async def test_double_submit_returns_409(client: AsyncClient, override_get_db):
    user = await register_user(client)
    client.headers["Authorization"] = f"Bearer {user['access_token']}"
    payload = make_onboarding_payload()
    resp1 = await client.post(ONBOARD_URL, json=payload)
    assert resp1.status_code == 201
    resp2 = await client.post(ONBOARD_URL, json=payload)
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_missing_required_field_returns_422(client: AsyncClient, override_get_db):
    user = await register_user(client)
    client.headers["Authorization"] = f"Bearer {user['access_token']}"
    payload = make_onboarding_payload()
    del payload["age_years"]
    resp = await client.post(ONBOARD_URL, json=payload)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_invalid_goal_type_returns_422(client: AsyncClient, override_get_db):
    user = await register_user(client)
    client.headers["Authorization"] = f"Bearer {user['access_token']}"
    payload = make_onboarding_payload(goal_type="INVALID_GOAL")
    resp = await client.post(ONBOARD_URL, json=payload)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_onboarding_without_auth_returns_401(client: AsyncClient, override_get_db):
    client.headers.pop("Authorization", None)
    resp = await client.post(ONBOARD_URL, json=make_onboarding_payload())
    assert resp.status_code == 401
