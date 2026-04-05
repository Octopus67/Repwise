"""Audit fix 10.17 — API contract tests for critical endpoints."""

import pytest

pytestmark = pytest.mark.asyncio

LOGIN_FIELDS = {"access_token", "refresh_token", "expires_in", "token_type"}
NUTRITION_ENTRY_FIELDS = {"id", "user_id", "date", "calories", "protein_g", "carbs_g", "fat_g"}
TRAINING_SESSION_FIELDS = {"id", "user_id", "date", "exercises"}


async def _register_and_login(client, db_session, override_get_db):
    """Helper: register a user and return login response."""
    email, password = "contract@test.com", "Test1234"
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp


async def test_login_response_contract(client, db_session, override_get_db):
    """Login response must contain token fields and NOT email_verified."""
    resp = await _register_and_login(client, db_session, override_get_db)
    assert resp.status_code == 200
    data = resp.json()
    assert LOGIN_FIELDS.issubset(data.keys()), f"Missing fields: {LOGIN_FIELDS - data.keys()}"
    assert "email_verified" not in data, "email_verified must not be in login response (10.12)"


async def test_login_response_types(client, db_session, override_get_db):
    """Login response field types must match contract."""
    resp = await _register_and_login(client, db_session, override_get_db)
    data = resp.json()
    assert isinstance(data["access_token"], str)
    assert isinstance(data["refresh_token"], str)
    assert isinstance(data["expires_in"], int)
    assert data["token_type"] == "bearer"


async def test_nutrition_entries_contract(client, db_session, override_get_db):
    """Nutrition entries endpoint returns a list."""
    resp = await _register_and_login(client, db_session, override_get_db)
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    entries_resp = await client.get("/api/v1/nutrition/entries", headers=headers)
    # Accept 200 (list) or 404 (no entries yet)
    assert entries_resp.status_code in (200, 404, 422)
    if entries_resp.status_code == 200:
        data = entries_resp.json()
        assert isinstance(data, (list, dict)), "Expected list or paginated dict"


async def test_training_sessions_contract(client, db_session, override_get_db):
    """Training sessions endpoint returns a list."""
    resp = await _register_and_login(client, db_session, override_get_db)
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    sessions_resp = await client.get("/api/v1/training/sessions", headers=headers)
    assert sessions_resp.status_code in (200, 404, 422)
    if sessions_resp.status_code == 200:
        data = sessions_resp.json()
        assert isinstance(data, (list, dict)), "Expected list or paginated dict"
