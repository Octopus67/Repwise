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
        {"sub": str(user_id), "type": "access", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
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
