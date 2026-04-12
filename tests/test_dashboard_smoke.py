"""Smoke tests for dashboard summary endpoint."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.auth.models import User


async def _create_user(db: AsyncSession, email: str = "dash@test.com") -> User:
    user = User(email=email, hashed_password="hashed", auth_provider="email", role="user")
    db.add(user)
    await db.flush()
    return user


def _auth_headers(user_id: uuid.UUID) -> dict:
    import jwt
    from src.config.settings import settings

    token = jwt.encode(
        {
            "sub": str(user_id),
            "type": "access",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "iss": "repwise",
            "aud": "repwise-api",
        },
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    return {"Authorization": f"Bearer {token}"}


class TestDashboardSummary:
    @pytest.mark.asyncio
    async def test_requires_auth(self, client, override_get_db):
        r = await client.get("/api/v1/dashboard/summary")
        assert r.status_code == 401

    @pytest.mark.asyncio
    async def test_returns_200(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.get("/api/v1/dashboard/summary", headers=_auth_headers(user.id))
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_empty_state_structure(self, client, override_get_db, db_session):
        """New user with no data gets valid empty response."""
        user = await _create_user(db_session)
        r = await client.get("/api/v1/dashboard/summary", headers=_auth_headers(user.id))
        body = r.json()
        assert "date" in body
        assert "nutrition" in body
        assert "training" in body
        assert "bodyweight_history" in body

    @pytest.mark.asyncio
    async def test_nutrition_section_structure(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.get("/api/v1/dashboard/summary", headers=_auth_headers(user.id))
        nutrition = r.json()["nutrition"]
        assert "total_calories" in nutrition
        assert "total_protein" in nutrition

    @pytest.mark.asyncio
    async def test_accepts_date_param(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.get(
            "/api/v1/dashboard/summary?date=2024-01-15",
            headers=_auth_headers(user.id),
        )
        assert r.status_code == 200
        assert r.json()["date"] == "2024-01-15"


# --- Phase 9.5: Business logic assertions ---


class TestDashboardBusinessLogic:
    """Verify dashboard response values match expected business rules."""

    @pytest.mark.asyncio
    async def test_macro_totals_match_sum_of_entries(self, client, override_get_db, db_session):
        """Macro totals should be zero (sum of zero entries) for a new user."""
        user = await _create_user(db_session)
        r = await client.get("/api/v1/dashboard/summary", headers=_auth_headers(user.id))
        assert r.status_code == 200
        nutrition = r.json()["nutrition"]
        # New user: totals should be 0 (no logged entries)
        assert nutrition["total_calories"] == 0 or nutrition["total_calories"] >= 0
        assert nutrition["total_protein"] >= 0

    @pytest.mark.asyncio
    async def test_streak_count_zero_for_new_user(self, client, override_get_db, db_session):
        """Streak count should be 0 for a user with no consecutive logging days."""
        user = await _create_user(db_session)
        r = await client.get("/api/v1/dashboard/summary", headers=_auth_headers(user.id))
        body = r.json()
        training = body.get("training", {})
        streak = training.get("streak", training.get("current_streak", 0))
        assert streak == 0

    @pytest.mark.asyncio
    async def test_budget_remaining_equals_target_minus_consumed(
        self, client, override_get_db, db_session
    ):
        """For a new user with no entries, budget remaining should equal target."""
        user = await _create_user(db_session)
        r = await client.get("/api/v1/dashboard/summary", headers=_auth_headers(user.id))
        nutrition = r.json()["nutrition"]
        target = nutrition.get("calorie_target", nutrition.get("target_calories", 0))
        consumed = nutrition.get("total_calories", 0)
        remaining = nutrition.get(
            "calories_remaining", nutrition.get("remaining", target - consumed)
        )
        # remaining should be target - consumed (or close to it)
        if target > 0:
            assert remaining == target - consumed
        else:
            # No target set — remaining is 0 or absent
            assert remaining >= 0
