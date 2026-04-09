"""Tests for dietary analysis endpoints — trends, gaps, recommendations."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import patch

from src.modules.auth.models import User
from src.modules.nutrition.models import NutritionEntry
from src.modules.payments.models import Subscription


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_user(db: AsyncSession, email: str = "diet@test.com") -> User:
    user = User(email=email, hashed_password="hashed", auth_provider="email", role="user")
    db.add(user)
    await db.flush()
    return user


async def _make_premium(db: AsyncSession, user: User) -> None:
    sub = Subscription(
        user_id=user.id,
        provider_name="stripe",
        status="active",
    )
    db.add(sub)
    await db.flush()


async def _add_nutrition(db: AsyncSession, user_id: uuid.UUID, days_ago: int = 0) -> None:
    entry = NutritionEntry(
        user_id=user_id,
        entry_date=date.today() - timedelta(days=days_ago),
        meal_name="Lunch",
        calories=2000,
        protein_g=100,
        carbs_g=250,
        fat_g=70,
    )
    db.add(entry)
    await db.flush()


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


def _no_rate_limit():
    from unittest.mock import AsyncMock

    return patch(
        "src.modules.dietary_analysis.router.check_user_endpoint_rate_limit", new=AsyncMock()
    )


# ---------------------------------------------------------------------------
# Auth tests
# ---------------------------------------------------------------------------


class TestDietaryAuth:
    @pytest.mark.asyncio
    async def test_trends_requires_auth(self, client, override_get_db):
        r = await client.get("/api/v1/dietary/trends")
        assert r.status_code == 401

    @pytest.mark.asyncio
    async def test_gaps_requires_auth(self, client, override_get_db):
        r = await client.get("/api/v1/dietary/gaps")
        assert r.status_code == 401

    @pytest.mark.asyncio
    async def test_recommendations_requires_auth(self, client, override_get_db):
        r = await client.get("/api/v1/dietary/recommendations")
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Premium gating
# ---------------------------------------------------------------------------


class TestDietaryPremiumGating:
    @pytest.mark.asyncio
    async def test_gaps_requires_premium(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        with _no_rate_limit():
            r = await client.get("/api/v1/dietary/gaps", headers=_auth_headers(user.id))
        assert r.status_code == 403

    @pytest.mark.asyncio
    async def test_recommendations_requires_premium(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        with _no_rate_limit():
            r = await client.get("/api/v1/dietary/recommendations", headers=_auth_headers(user.id))
        assert r.status_code == 403

    @pytest.mark.asyncio
    async def test_trends_available_to_free_users(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        with _no_rate_limit():
            r = await client.get("/api/v1/dietary/trends", headers=_auth_headers(user.id))
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# GET /dietary/trends
# ---------------------------------------------------------------------------


class TestDietaryTrends:
    @pytest.mark.asyncio
    async def test_empty_data(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        with _no_rate_limit():
            r = await client.get("/api/v1/dietary/trends", headers=_auth_headers(user.id))
        data = r.json()
        assert data["window_days"] == 7
        assert isinstance(data["daily_summaries"], list)
        assert "averages" in data

    @pytest.mark.asyncio
    async def test_with_nutrition_data(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        await _add_nutrition(db_session, user.id, days_ago=0)
        await _add_nutrition(db_session, user.id, days_ago=1)
        with _no_rate_limit():
            r = await client.get("/api/v1/dietary/trends", headers=_auth_headers(user.id))
        assert r.status_code == 200
        data = r.json()
        assert data["averages"]["calories"] > 0

    @pytest.mark.asyncio
    async def test_custom_window(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        with _no_rate_limit():
            r = await client.get(
                "/api/v1/dietary/trends?window_days=30", headers=_auth_headers(user.id)
            )
        assert r.json()["window_days"] == 30

    @pytest.mark.asyncio
    async def test_window_min_validation(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        with _no_rate_limit():
            r = await client.get(
                "/api/v1/dietary/trends?window_days=0", headers=_auth_headers(user.id)
            )
        assert r.status_code == 400

    @pytest.mark.asyncio
    async def test_window_max_validation(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        with _no_rate_limit():
            r = await client.get(
                "/api/v1/dietary/trends?window_days=91", headers=_auth_headers(user.id)
            )
        assert r.status_code == 400

    @pytest.mark.asyncio
    async def test_response_structure(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        with _no_rate_limit():
            r = await client.get("/api/v1/dietary/trends", headers=_auth_headers(user.id))
        data = r.json()
        assert set(data.keys()) == {"window_days", "daily_summaries", "averages"}
        avg = data["averages"]
        for key in ("calories", "protein_g", "carbs_g", "fat_g", "num_days"):
            assert key in avg


# ---------------------------------------------------------------------------
# GET /dietary/gaps
# ---------------------------------------------------------------------------


class TestDietaryGaps:
    @pytest.mark.asyncio
    async def test_empty_data_returns_gaps(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        await _make_premium(db_session, user)
        with _no_rate_limit():
            r = await client.get("/api/v1/dietary/gaps", headers=_auth_headers(user.id))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    @pytest.mark.asyncio
    async def test_gap_structure(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        await _make_premium(db_session, user)
        with _no_rate_limit():
            r = await client.get("/api/v1/dietary/gaps", headers=_auth_headers(user.id))
        gaps = r.json()
        if gaps:
            for key in ("nutrient", "average_intake", "recommended_value", "deficit_percentage"):
                assert key in gaps[0]

    @pytest.mark.asyncio
    async def test_custom_window(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        await _make_premium(db_session, user)
        with _no_rate_limit():
            r = await client.get(
                "/api/v1/dietary/gaps?window_days=14", headers=_auth_headers(user.id)
            )
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# GET /dietary/recommendations
# ---------------------------------------------------------------------------


class TestDietaryRecommendations:
    @pytest.mark.asyncio
    async def test_returns_list(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        await _make_premium(db_session, user)
        with _no_rate_limit():
            r = await client.get("/api/v1/dietary/recommendations", headers=_auth_headers(user.id))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    @pytest.mark.asyncio
    async def test_recommendation_structure(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        await _make_premium(db_session, user)
        with _no_rate_limit():
            r = await client.get("/api/v1/dietary/recommendations", headers=_auth_headers(user.id))
        recs = r.json()
        if recs:
            for key in ("nutrient", "food_name", "nutrient_amount_per_serving", "serving_size"):
                assert key in recs[0]
