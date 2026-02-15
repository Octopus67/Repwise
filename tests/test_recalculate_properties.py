"""Unit tests for the recalculate endpoint — task 5.1.

Validates: Requirements 2.2, 3.2, 9.1, 9.2, 9.4
"""

import pytest

from src.middleware.rate_limiter import clear_all


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

ONBOARDING_PAYLOAD = {
    "goal_type": "cutting",
    "height_cm": 175.0,
    "weight_kg": 80.0,
    "body_fat_pct": 18.0,
    "age_years": 28,
    "sex": "male",
    "activity_level": "moderate",
    "goal_rate_per_week": -0.5,
    "display_name": "Recalc User",
}


@pytest.fixture(autouse=True)
def _clear_rate_limiter():
    clear_all()
    yield
    clear_all()


async def _register_onboard_and_get_headers(client, email: str = "recalc@example.com") -> dict[str, str]:
    """Register a user, complete onboarding, ensure age/sex in profile prefs, return auth headers."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "securepass123"},
    )
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Complete onboarding — sets up metrics, goals, and adaptive snapshot
    onboard_resp = await client.post(
        "/api/v1/onboarding/complete",
        json=ONBOARDING_PAYLOAD,
        headers=headers,
    )
    assert onboard_resp.status_code == 201

    # Ensure age_years and sex are persisted in profile preferences.
    # The onboarding service may modify a Pydantic response object rather than
    # the ORM model, so we explicitly set preferences via PUT /users/profile.
    profile_resp = await client.get("/api/v1/users/profile", headers=headers)
    existing_prefs = profile_resp.json().get("preferences") or {}
    existing_prefs["age_years"] = ONBOARDING_PAYLOAD["age_years"]
    existing_prefs["sex"] = ONBOARDING_PAYLOAD["sex"]

    put_resp = await client.put(
        "/api/v1/users/profile",
        json={"preferences": existing_prefs},
        headers=headers,
    )
    assert put_resp.status_code == 200

    return headers


# ------------------------------------------------------------------
# Test 1: POST with valid metrics → returns updated metrics + targets
# Validates: Requirements 2.2, 9.1
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_recalculate_with_valid_metrics(client, override_get_db):
    """POST /users/recalculate with metrics only → 200, returns metrics + targets with calories > 0."""
    headers = await _register_onboard_and_get_headers(client)

    resp = await client.post(
        "/api/v1/users/recalculate",
        json={
            "metrics": {
                "height_cm": 180.0,
                "weight_kg": 82.0,
                "body_fat_pct": 16.0,
                "activity_level": "active",
            }
        },
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()

    # Metrics returned
    assert body["metrics"] is not None
    assert body["metrics"]["height_cm"] == 180.0
    assert body["metrics"]["weight_kg"] == 82.0
    assert body["metrics"]["activity_level"] == "active"

    # Goals not sent, so should be None
    assert body["goals"] is None

    # Targets present and positive
    assert body["targets"]["calories"] > 0
    assert body["targets"]["protein_g"] > 0
    assert body["targets"]["carbs_g"] >= 0
    assert body["targets"]["fat_g"] > 0


# ------------------------------------------------------------------
# Test 2: POST with valid goals → returns updated goals + targets
# Validates: Requirements 3.2, 9.2
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_recalculate_with_valid_goals(client, override_get_db):
    """POST /users/recalculate with goals only → 200, returns goals + targets."""
    headers = await _register_onboard_and_get_headers(client, email="goals@example.com")

    resp = await client.post(
        "/api/v1/users/recalculate",
        json={
            "goals": {
                "goal_type": "bulking",
                "target_weight_kg": 90.0,
                "goal_rate_per_week": 0.3,
            }
        },
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()

    # Goals returned
    assert body["goals"] is not None
    assert body["goals"]["goal_type"] == "bulking"
    assert body["goals"]["target_weight_kg"] == 90.0
    assert body["goals"]["goal_rate_per_week"] == 0.3

    # Metrics not sent, so should be None
    assert body["metrics"] is None

    # Targets present and positive
    assert body["targets"]["calories"] > 0
    assert body["targets"]["protein_g"] > 0


# ------------------------------------------------------------------
# Test 3: POST with both metrics and goals → returns both + targets
# Validates: Requirements 2.2, 3.2, 9.1, 9.2
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_recalculate_with_both_metrics_and_goals(client, override_get_db):
    """POST /users/recalculate with both → 200, returns metrics + goals + targets."""
    headers = await _register_onboard_and_get_headers(client, email="both@example.com")

    resp = await client.post(
        "/api/v1/users/recalculate",
        json={
            "metrics": {
                "height_cm": 185.0,
                "weight_kg": 90.0,
                "activity_level": "very_active",
            },
            "goals": {
                "goal_type": "maintaining",
                "goal_rate_per_week": 0.0,
            },
        },
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()

    assert body["metrics"] is not None
    assert body["metrics"]["weight_kg"] == 90.0
    assert body["goals"] is not None
    assert body["goals"]["goal_type"] == "maintaining"
    assert body["targets"]["calories"] > 0
    assert body["targets"]["protein_g"] > 0
    assert body["targets"]["fat_g"] > 0


# ------------------------------------------------------------------
# Test 4: POST with both fields None → 400 validation error
# Validates: Requirements 9.1, 9.2
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_recalculate_both_none_returns_400(client, override_get_db):
    """POST /users/recalculate with neither metrics nor goals → 400."""
    headers = await _register_onboard_and_get_headers(client, email="none@example.com")

    resp = await client.post(
        "/api/v1/users/recalculate",
        json={"metrics": None, "goals": None},
        headers=headers,
    )
    assert resp.status_code == 400


# ------------------------------------------------------------------
# Test 5: POST without auth → 401
# Validates: Requirements 9.1
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_recalculate_without_auth_returns_401(client, override_get_db):
    """POST /users/recalculate without Authorization header → 401."""
    resp = await client.post(
        "/api/v1/users/recalculate",
        json={"metrics": {"weight_kg": 80.0, "height_cm": 175.0}},
    )
    assert resp.status_code == 401


# ------------------------------------------------------------------
# Test 6: Regression — existing endpoints still work
# Validates: Requirements 9.4
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_existing_endpoints_still_work(client, override_get_db):
    """GET /users/profile, POST /users/metrics, PUT /users/goals still function correctly."""
    headers = await _register_onboard_and_get_headers(client, email="regression@example.com")

    # GET /users/profile
    profile_resp = await client.get("/api/v1/users/profile", headers=headers)
    assert profile_resp.status_code == 200
    assert "user_id" in profile_resp.json()

    # POST /users/metrics
    metrics_resp = await client.post(
        "/api/v1/users/metrics",
        json={"height_cm": 170.0, "weight_kg": 75.0, "activity_level": "light"},
        headers=headers,
    )
    assert metrics_resp.status_code == 201
    assert metrics_resp.json()["weight_kg"] == 75.0

    # PUT /users/goals
    goals_resp = await client.put(
        "/api/v1/users/goals",
        json={"goal_type": "maintaining", "goal_rate_per_week": 0.0},
        headers=headers,
    )
    assert goals_resp.status_code == 200
    assert goals_resp.json()["goal_type"] == "maintaining"


# ------------------------------------------------------------------
# Test 7: Recalculate with no bodyweight history → uses current weight
# Validates: Requirements 9.1, 9.2
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_recalculate_no_bodyweight_history_uses_fallback(client, override_get_db):
    """Recalculate with no bodyweight_logs → uses current weight as fallback, returns valid targets."""
    # Register and onboard (onboarding does NOT create bodyweight_logs entries,
    # only user_metrics and user_goals — so bodyweight_logs is empty)
    headers = await _register_onboard_and_get_headers(client, email="nobw@example.com")

    # Recalculate with new metrics — no bodyweight_logs exist
    resp = await client.post(
        "/api/v1/users/recalculate",
        json={
            "metrics": {
                "height_cm": 178.0,
                "weight_kg": 85.0,
                "activity_level": "moderate",
            }
        },
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()

    # Should still return valid targets using weight_kg as single-entry fallback
    assert body["targets"]["calories"] > 0
    assert body["targets"]["protein_g"] > 0
    assert body["targets"]["carbs_g"] >= 0
    assert body["targets"]["fat_g"] > 0
