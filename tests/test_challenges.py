"""Tests for weekly challenges endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.auth.models import User


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_user(db: AsyncSession, email: str = "challenge@test.com") -> User:
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


# ---------------------------------------------------------------------------
# Auth tests
# ---------------------------------------------------------------------------

class TestChallengesAuth:
    @pytest.mark.asyncio
    async def test_get_current_requires_auth(self, client, override_get_db):
        r = await client.get("/api/v1/challenges/current")
        assert r.status_code == 401

    @pytest.mark.asyncio
    async def test_update_progress_requires_auth(self, client, override_get_db):
        r = await client.post(f"/api/v1/challenges/{uuid.uuid4()}/progress", json={"value": 1})
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# GET /challenges/current
# ---------------------------------------------------------------------------

class TestGetCurrentChallenges:
    @pytest.mark.asyncio
    async def test_auto_generates_challenges(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.get("/api/v1/challenges/current", headers=_auth_headers(user.id))
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 3

    @pytest.mark.asyncio
    async def test_challenge_response_structure(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.get("/api/v1/challenges/current", headers=_auth_headers(user.id))
        ch = r.json()[0]
        for key in ("id", "challenge_type", "title", "description", "target_value", "current_value", "week_start", "week_end", "completed"):
            assert key in ch

    @pytest.mark.asyncio
    async def test_idempotent_generation(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r1 = await client.get("/api/v1/challenges/current", headers=_auth_headers(user.id))
        r2 = await client.get("/api/v1/challenges/current", headers=_auth_headers(user.id))
        ids1 = {c["id"] for c in r1.json()}
        ids2 = {c["id"] for c in r2.json()}
        assert ids1 == ids2

    @pytest.mark.asyncio
    async def test_challenges_start_at_zero(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.get("/api/v1/challenges/current", headers=_auth_headers(user.id))
        for ch in r.json():
            assert ch["current_value"] == 0
            assert ch["completed"] is False

    @pytest.mark.asyncio
    async def test_user_isolation(self, client, override_get_db, db_session):
        u1 = await _create_user(db_session, "u1@test.com")
        u2 = await _create_user(db_session, "u2@test.com")
        r1 = await client.get("/api/v1/challenges/current", headers=_auth_headers(u1.id))
        r2 = await client.get("/api/v1/challenges/current", headers=_auth_headers(u2.id))
        ids1 = {c["id"] for c in r1.json()}
        ids2 = {c["id"] for c in r2.json()}
        assert ids1.isdisjoint(ids2)


# ---------------------------------------------------------------------------
# POST /challenges/{id}/progress
# ---------------------------------------------------------------------------

class TestUpdateProgress:
    @pytest.mark.asyncio
    async def test_update_progress(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        challenges = (await client.get("/api/v1/challenges/current", headers=_auth_headers(user.id))).json()
        ch_id = challenges[0]["id"]
        r = await client.post(f"/api/v1/challenges/{ch_id}/progress", json={"value": 10}, headers=_auth_headers(user.id))
        assert r.status_code == 200
        assert r.json()["current_value"] == 10

    @pytest.mark.asyncio
    async def test_completion_detection(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        challenges = (await client.get("/api/v1/challenges/current", headers=_auth_headers(user.id))).json()
        # Pick workout_count (target=4) which is within the 0-10000 validation range
        ch = next(c for c in challenges if c["challenge_type"] == "workout_count")
        r = await client.post(
            f"/api/v1/challenges/{ch['id']}/progress",
            json={"value": ch["target_value"]},
            headers=_auth_headers(user.id),
        )
        assert r.json()["completed"] is True
        assert r.json()["completed_at"] is not None

    @pytest.mark.asyncio
    async def test_not_completed_below_target(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        challenges = (await client.get("/api/v1/challenges/current", headers=_auth_headers(user.id))).json()
        ch = next(c for c in challenges if c["challenge_type"] == "workout_count")
        r = await client.post(
            f"/api/v1/challenges/{ch['id']}/progress",
            json={"value": ch["target_value"] - 1},
            headers=_auth_headers(user.id),
        )
        assert r.json()["completed"] is False

    @pytest.mark.asyncio
    async def test_not_found_for_other_user(self, client, override_get_db, db_session):
        u1 = await _create_user(db_session, "owner@test.com")
        u2 = await _create_user(db_session, "other@test.com")
        challenges = (await client.get("/api/v1/challenges/current", headers=_auth_headers(u1.id))).json()
        r = await client.post(
            f"/api/v1/challenges/{challenges[0]['id']}/progress",
            json={"value": 1},
            headers=_auth_headers(u2.id),
        )
        assert r.status_code == 404

    @pytest.mark.asyncio
    async def test_not_found_for_nonexistent(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.post(
            f"/api/v1/challenges/{uuid.uuid4()}/progress",
            json={"value": 1},
            headers=_auth_headers(user.id),
        )
        assert r.status_code == 404

    @pytest.mark.asyncio
    async def test_negative_value_rejected(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        challenges = (await client.get("/api/v1/challenges/current", headers=_auth_headers(user.id))).json()
        r = await client.post(
            f"/api/v1/challenges/{challenges[0]['id']}/progress",
            json={"value": -1},
            headers=_auth_headers(user.id),
        )
        assert r.status_code == 400

    @pytest.mark.asyncio
    async def test_value_over_max_rejected(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        challenges = (await client.get("/api/v1/challenges/current", headers=_auth_headers(user.id))).json()
        r = await client.post(
            f"/api/v1/challenges/{challenges[0]['id']}/progress",
            json={"value": 10001},
            headers=_auth_headers(user.id),
        )
        assert r.status_code == 400
