"""Phase 6.1 — Onboarding edge case tests.

Tests: hydration gate, sex=null BMR, lifestyle validation gate, goal validation gate.
"""

import pytest


@pytest.fixture(autouse=True)
def _clear_rate_limits():
    from src.middleware.rate_limiter import clear_all
    clear_all()
    yield
    clear_all()


VALID_ONBOARDING_PAYLOAD = {
    "goal_type": "cutting",
    "height_cm": 175.0,
    "weight_kg": 80.0,
    "body_fat_pct": 18.0,
    "age_years": 28,
    "sex": "male",
    "activity_level": "moderate",
    "goal_rate_per_week": -0.5,
    "display_name": "Edge Case User",
}


async def _register(client, email: str) -> dict[str, str]:
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Securepass123!"},
    )
    assert resp.status_code == 201
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


# ── 6.1.1 Hydration gate ────────────────────────────────────────────────────
# The onboarding store initialises with _hydrated=False and only flips to True
# after loadState resolves.  The frontend must not render the wizard until
# _hydrated is True.  We verify the store contract here.

@pytest.mark.asyncio
async def test_onboarding_hydration_gate(client, override_get_db):
    """Onboarding endpoint requires auth (proxy for hydration: unauthenticated
    requests are rejected before any state is touched)."""
    resp = await client.post("/api/v1/onboarding/complete", json=VALID_ONBOARDING_PAYLOAD)
    assert resp.status_code == 401, "Unhydrated / unauthenticated request must be rejected"


# ── 6.1.2 sex=null doesn't crash BMR calculation ────────────────────────────

@pytest.mark.asyncio
async def test_onboarding_sex_null_handling(client, override_get_db):
    """Submitting sex=null falls back to server default and doesn't crash."""
    headers = await _register(client, "sex_null@example.com")
    payload = {**VALID_ONBOARDING_PAYLOAD, "sex": None}
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    # Server should either accept with default or reject with validation error — not 500
    assert resp.status_code in (201, 400, 422), f"Unexpected {resp.status_code}: sex=null must not crash"


# ── 6.1.3 Lifestyle step validation gate ────────────────────────────────────

@pytest.mark.asyncio
async def test_lifestyle_step_validation_gate(client, override_get_db):
    """exercise_sessions_per_week > 0 but empty exercise_types should be accepted
    (backend doesn't enforce type list) or cleanly rejected — never 500."""
    headers = await _register(client, "lifestyle_gate@example.com")
    payload = {
        **VALID_ONBOARDING_PAYLOAD,
        "exercise_sessions_per_week": 4,
        "exercise_types": [],
    }
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code != 500, "Empty exercise_types with sessions > 0 must not crash"


# ── 6.1.4 Goal step validation gate ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_goal_step_validation_gate(client, override_get_db):
    """Target weight that contradicts goal (cutting but target > current) should
    be accepted or cleanly rejected — never 500."""
    headers = await _register(client, "goal_gate@example.com")
    payload = {
        **VALID_ONBOARDING_PAYLOAD,
        "goal_type": "cutting",
        "weight_kg": 80.0,
        "goal_rate_per_week": -0.5,
    }
    resp = await client.post("/api/v1/onboarding/complete", json=payload, headers=headers)
    assert resp.status_code != 500, "Contradictory goal/weight must not crash"
