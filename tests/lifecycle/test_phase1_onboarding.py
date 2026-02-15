"""Phase 1: Onboarding & Signup — User Lifecycle Simulation Suite.

Tests registration, profile setup, goal setting, initial adaptive snapshot,
and edge cases for all 4 personas.
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from tests.lifecycle.api_client import LifecycleClient
from tests.lifecycle.personas import (
    ALL_PERSONAS,
    PERSONA_A,
    PERSONA_B,
    PERSONA_C,
    PERSONA_D,
    PersonaProfile,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def client(override_get_db) -> LifecycleClient:
    c = LifecycleClient()
    yield c
    await c.close()


async def _onboard_persona(client: LifecycleClient, p: PersonaProfile) -> dict:
    """Register, set profile, set goals, create initial snapshot. Returns snapshot."""
    # 1. Register
    auth = await client.register(p.email, p.password)
    assert "access_token" in auth
    assert auth["token_type"] == "bearer"

    # 2. Get user identity
    me = await client.get_me()
    assert me["email"] == p.email

    # 3. Set profile
    profile = await client.update_profile(display_name=p.display_name)
    assert profile["display_name"] == p.display_name

    # 4. Log initial metrics
    metrics = await client.log_metrics(
        height_cm=p.height_cm,
        weight_kg=p.weight_kg,
        body_fat_pct=p.body_fat_pct,
        activity_level=p.activity_level,
    )
    assert metrics["height_cm"] == p.height_cm
    assert metrics["weight_kg"] == p.weight_kg

    # 5. Set goals
    goals = await client.set_goals(
        goal_type=p.goal_type,
        goal_rate_per_week=p.goal_rate_per_week,
    )
    assert goals["goal_type"] == p.goal_type

    # 6. Log initial bodyweight
    from datetime import date
    bw = await client.log_bodyweight(p.weight_kg, date.today())
    assert abs(bw["weight_kg"] - p.weight_kg) < 0.01

    # 7. Create initial adaptive snapshot
    snapshot = await client.create_snapshot({
        "weight_kg": p.weight_kg,
        "height_cm": p.height_cm,
        "age_years": p.age_years,
        "sex": p.sex,
        "activity_level": p.activity_level,
        "goal_type": p.goal_type,
        "goal_rate_per_week": p.goal_rate_per_week,
        "bodyweight_history": [{"date": date.today().isoformat(), "weight_kg": p.weight_kg}],
        "training_load_score": 0.0,
    })
    assert snapshot["target_calories"] > 0
    assert snapshot["target_protein_g"] > 0

    return snapshot


# ===========================================================================
# Phase 1.1: Registration — Happy Path
# ===========================================================================


class TestRegistration:
    """Verify all 4 personas can register successfully."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("persona", ALL_PERSONAS, ids=[p.name for p in ALL_PERSONAS])
    async def test_register_persona(self, persona: PersonaProfile, override_get_db):
        client = LifecycleClient()
        try:
            auth = await client.register(persona.email, persona.password)
            assert "access_token" in auth
            assert "refresh_token" in auth
            assert auth["token_type"] == "bearer"
            assert auth["expires_in"] > 0

            # Verify identity
            me = await client.get_me()
            assert me["email"] == persona.email
            assert "id" in me
        finally:
            await client.close()

    @pytest.mark.asyncio
    async def test_duplicate_registration_rejected(self, override_get_db):
        """Registering the same email twice returns 409."""
        c = LifecycleClient()
        try:
            await c.register("dup@test.com", "Password123!")
            resp = await c.raw_post(
                "/api/v1/auth/register",
                json={"email": "dup@test.com", "password": "Password123!"},
            )
            assert resp.status_code == 409
        finally:
            await c.close()

    @pytest.mark.asyncio
    async def test_weak_password_rejected(self, override_get_db):
        """Password shorter than 8 chars is rejected."""
        c = LifecycleClient()
        try:
            resp = await c.raw_post(
                "/api/v1/auth/register",
                json={"email": "weak@test.com", "password": "short"},
            )
            assert resp.status_code in (400, 422)
        finally:
            await c.close()

    @pytest.mark.asyncio
    async def test_invalid_email_rejected(self, override_get_db):
        """Invalid email format is rejected."""
        c = LifecycleClient()
        try:
            resp = await c.raw_post(
                "/api/v1/auth/register",
                json={"email": "not-an-email", "password": "Password123!"},
            )
            assert resp.status_code in (400, 422)
        finally:
            await c.close()


# ===========================================================================
# Phase 1.2: Full Onboarding Flow
# ===========================================================================


class TestOnboardingFlow:
    """Verify complete onboarding for each persona."""

    @pytest.mark.asyncio
    async def test_persona_a_onboarding(self, override_get_db):
        """Persona A (beginner, weight loss) completes full onboarding."""
        c = LifecycleClient()
        try:
            snapshot = await _onboard_persona(c, PERSONA_A)

            # Cutting goal → calories should be below maintenance
            assert snapshot["target_calories"] > 1200  # not dangerously low
            assert snapshot["target_protein_g"] >= 80  # adequate protein

            # Verify goals are retrievable
            goals = await c.get_goals()
            assert goals["goal_type"] == "cutting"
            assert goals["goal_rate_per_week"] == -0.5
        finally:
            await c.close()

    @pytest.mark.asyncio
    async def test_persona_b_onboarding(self, override_get_db):
        """Persona B (experienced lifter, bulking) completes full onboarding."""
        c = LifecycleClient()
        try:
            snapshot = await _onboard_persona(c, PERSONA_B)

            # Bulking → higher calories
            assert snapshot["target_calories"] > 2500
            assert snapshot["target_protein_g"] >= 150  # high protein for lifter

            goals = await c.get_goals()
            assert goals["goal_type"] == "bulking"
        finally:
            await c.close()

    @pytest.mark.asyncio
    async def test_persona_c_onboarding(self, override_get_db):
        """Persona C (casual, maintenance) completes full onboarding."""
        c = LifecycleClient()
        try:
            snapshot = await _onboard_persona(c, PERSONA_C)

            # Maintenance → moderate calories
            assert 1800 < snapshot["target_calories"] < 3500

            goals = await c.get_goals()
            assert goals["goal_type"] == "maintaining"
        finally:
            await c.close()

    @pytest.mark.asyncio
    async def test_persona_d_onboarding(self, override_get_db):
        """Persona D (dropout) completes onboarding before going inactive."""
        c = LifecycleClient()
        try:
            snapshot = await _onboard_persona(c, PERSONA_D)
            assert snapshot["target_calories"] > 0

            goals = await c.get_goals()
            assert goals["goal_type"] == "maintaining"
        finally:
            await c.close()


# ===========================================================================
# Phase 1.3: Profile Data Integrity
# ===========================================================================


class TestProfileIntegrity:
    """Verify all profile data is stored correctly and retrievable."""

    @pytest.mark.asyncio
    async def test_profile_reflects_onboarding_data(self, override_get_db):
        """After onboarding, profile contains the correct display name."""
        c = LifecycleClient()
        try:
            await _onboard_persona(c, PERSONA_A)
            profile = await c.get_profile()
            assert profile["display_name"] == "Anna"
        finally:
            await c.close()

    @pytest.mark.asyncio
    async def test_bodyweight_history_after_onboarding(self, override_get_db):
        """Initial bodyweight log is retrievable."""
        c = LifecycleClient()
        try:
            await _onboard_persona(c, PERSONA_B)
            history = await c.get_bodyweight_history()
            assert history["total_count"] >= 1
            assert any(
                abs(item["weight_kg"] - 88.0) < 0.01
                for item in history["items"]
            )
        finally:
            await c.close()

    @pytest.mark.asyncio
    async def test_goals_match_persona(self, override_get_db):
        """Goals endpoint returns the exact values set during onboarding."""
        c = LifecycleClient()
        try:
            await _onboard_persona(c, PERSONA_A)
            goals = await c.get_goals()
            assert goals["goal_type"] == "cutting"
            assert goals["goal_rate_per_week"] == -0.5
        finally:
            await c.close()


# ===========================================================================
# Phase 1.4: Edge Cases — Invalid Onboarding Data
# ===========================================================================


class TestOnboardingEdgeCases:
    """Verify validation catches invalid body measurements and inputs."""

    @pytest.mark.asyncio
    async def test_negative_weight_rejected(self, override_get_db):
        """Negative bodyweight is rejected."""
        c = LifecycleClient()
        try:
            await c.register("neg_weight@test.com", "Password123!")
            resp = await c.raw_post(
                "/api/v1/users/bodyweight",
                json={"weight_kg": -10, "recorded_date": "2025-01-01"},
            )
            assert resp.status_code in (400, 422)
        finally:
            await c.close()

    @pytest.mark.asyncio
    async def test_zero_weight_rejected(self, override_get_db):
        """Zero bodyweight is rejected."""
        c = LifecycleClient()
        try:
            await c.register("zero_weight@test.com", "Password123!")
            resp = await c.raw_post(
                "/api/v1/users/bodyweight",
                json={"weight_kg": 0, "recorded_date": "2025-01-01"},
            )
            assert resp.status_code in (400, 422)
        finally:
            await c.close()

    @pytest.mark.asyncio
    async def test_absurd_calories_in_snapshot_rejected(self, override_get_db):
        """Snapshot with weight_kg=0 should fail."""
        c = LifecycleClient()
        try:
            await c.register("absurd@test.com", "Password123!")
            resp = await c.raw_post(
                "/api/v1/adaptive/snapshots",
                json={
                    "weight_kg": 0,
                    "height_cm": 170,
                    "age_years": 30,
                    "sex": "male",
                    "activity_level": "sedentary",
                    "goal_type": "maintaining",
                    "goal_rate_per_week": 0,
                    "bodyweight_history": [{"date": "2025-01-01", "weight_kg": 0}],
                    "training_load_score": 0,
                },
            )
            assert resp.status_code in (400, 422)
        finally:
            await c.close()

    @pytest.mark.asyncio
    async def test_unauthenticated_profile_access_rejected(self, override_get_db):
        """Accessing profile without auth returns 401."""
        c = LifecycleClient()
        try:
            resp = await c.raw_get("/api/v1/users/profile")
            assert resp.status_code == 401
        finally:
            await c.close()
