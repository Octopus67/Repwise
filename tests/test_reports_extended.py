"""Tests for monthly and yearly report endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.middleware.rate_limiter import clear_all
from src.modules.auth.models import User


@pytest.fixture(autouse=True)
def _clear_rate_limiter():
    clear_all()
    yield
    clear_all()


async def _create_user(db: AsyncSession, email: str = "report@test.com") -> User:
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


class TestMonthlyReportAuth:
    @pytest.mark.asyncio
    async def test_requires_auth(self, client, override_get_db):
        r = await client.get("/api/v1/reports/monthly")
        assert r.status_code == 401


class TestMonthlyReport:
    @pytest.mark.asyncio
    async def test_returns_200(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.get("/api/v1/reports/monthly", headers=_auth_headers(user.id))
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_empty_data_structure(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.get("/api/v1/reports/monthly", headers=_auth_headers(user.id))
        body = r.json()
        assert "year" in body
        assert "month" in body
        assert "training" in body
        assert "nutrition" in body
        assert "body" in body

    @pytest.mark.asyncio
    async def test_with_year_month_params(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.get(
            "/api/v1/reports/monthly?year=2024&month=1",
            headers=_auth_headers(user.id),
        )
        assert r.status_code == 200
        body = r.json()
        assert body["year"] == 2024
        assert body["month"] == 1

    @pytest.mark.asyncio
    async def test_future_month_rejected(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.get(
            "/api/v1/reports/monthly?year=2099&month=12",
            headers=_auth_headers(user.id),
        )
        assert r.status_code == 400


class TestYearlyReportAuth:
    @pytest.mark.asyncio
    async def test_requires_auth(self, client, override_get_db):
        r = await client.get("/api/v1/reports/yearly")
        assert r.status_code == 401


class TestYearlyReport:
    @pytest.mark.asyncio
    async def test_returns_200(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.get("/api/v1/reports/yearly", headers=_auth_headers(user.id))
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_empty_data_structure(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.get("/api/v1/reports/yearly", headers=_auth_headers(user.id))
        body = r.json()
        assert "year" in body
        assert "training" in body
        assert "nutrition" in body
        assert "total_workouts" in body

    @pytest.mark.asyncio
    async def test_future_year_rejected(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.get(
            "/api/v1/reports/yearly?year=2099",
            headers=_auth_headers(user.id),
        )
        assert r.status_code == 400
