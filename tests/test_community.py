"""Tests for community links endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.auth.models import User


async def _create_user(db: AsyncSession, email: str = "comm@test.com", role: str = "user") -> User:
    user = User(email=email, hashed_password="hashed", auth_provider="email", role=role)
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


class TestCommunityGet:
    @pytest.mark.asyncio
    async def test_get_returns_default_links(self, client, override_get_db):
        """GET /community returns defaults when no admin config exists."""
        r = await client.get("/api/v1/community/")
        assert r.status_code == 200
        body = r.json()
        assert "telegram" in body
        assert "email" in body

    @pytest.mark.asyncio
    async def test_get_is_public(self, client, override_get_db):
        """GET /community does not require auth."""
        r = await client.get("/api/v1/community/")
        assert r.status_code == 200


class TestCommunityUpdate:
    @pytest.mark.asyncio
    async def test_put_requires_auth(self, client, override_get_db):
        r = await client.put(
            "/api/v1/community/", json={"telegram": "https://t.me/x", "email": "a@b.com"}
        )
        assert r.status_code == 401

    @pytest.mark.asyncio
    async def test_put_non_admin_gets_403(self, client, override_get_db, db_session):
        user = await _create_user(db_session, role="user")
        r = await client.put(
            "/api/v1/community/",
            json={"telegram": "https://t.me/x", "email": "a@b.com"},
            headers=_auth_headers(user.id),
        )
        assert r.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_can_update(self, client, override_get_db, db_session):
        admin = await _create_user(db_session, email="admin@test.com", role="admin")
        r = await client.put(
            "/api/v1/community/",
            json={"telegram": "https://t.me/new", "email": "new@repwise.app"},
            headers=_auth_headers(admin.id),
        )
        assert r.status_code == 200
        body = r.json()
        assert body["telegram"] == "https://t.me/new"
        assert body["email"] == "new@repwise.app"

    @pytest.mark.asyncio
    async def test_updated_links_persist(self, client, override_get_db, db_session):
        admin = await _create_user(db_session, email="admin2@test.com", role="admin")
        await client.put(
            "/api/v1/community/",
            json={"telegram": "https://t.me/persist", "email": "persist@repwise.app"},
            headers=_auth_headers(admin.id),
        )
        r = await client.get("/api/v1/community/")
        assert r.status_code == 200
        body = r.json()
        assert body["telegram"] == "https://t.me/persist"
