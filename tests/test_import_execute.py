"""Tests for import execute endpoint."""

from __future__ import annotations

import io
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.middleware.rate_limiter import clear_all
from src.modules.auth.models import User
from src.modules.training.models import TrainingSession

STRONG_CSV = """Date,Workout Name,Exercise Name,Weight,Reps,RPE
2024-01-15T10:00:00,Push Day,Bench Press,100,8,8
2024-01-15T10:00:00,Push Day,Bench Press,100,7,8.5
2024-01-15T10:00:00,Push Day,Overhead Press,60,10,
"""


@pytest.fixture(autouse=True)
def _clear_rate_limiter():
    clear_all()
    yield
    clear_all()


async def _create_user(db: AsyncSession, email: str = "import@test.com") -> User:
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


def _csv_file(content: str, filename: str = "workout.csv"):
    return {"file": (filename, io.BytesIO(content.encode()), "text/csv")}


class TestImportAuth:
    @pytest.mark.asyncio
    async def test_execute_requires_auth(self, client, override_get_db):
        r = await client.post("/api/v1/import/execute", files=_csv_file(STRONG_CSV))
        assert r.status_code == 401

    @pytest.mark.asyncio
    async def test_formats_requires_auth(self, client, override_get_db):
        r = await client.get("/api/v1/import/formats")
        assert r.status_code == 401


class TestImportExecute:
    @pytest.mark.asyncio
    async def test_valid_strong_csv(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.post(
            "/api/v1/import/execute",
            files=_csv_file(STRONG_CSV),
            data={"weight_unit": "kg"},
            headers=_auth_headers(user.id),
        )
        assert r.status_code == 200
        body = r.json()
        assert body["sessions_imported"] >= 1
        assert body["exercises_created"] >= 0

    @pytest.mark.asyncio
    async def test_empty_csv_returns_zero(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.post(
            "/api/v1/import/execute",
            files=_csv_file("Date,Workout Name,Exercise Name,Weight,Reps,RPE\n"),
            headers=_auth_headers(user.id),
        )
        assert r.status_code == 200
        assert r.json()["sessions_imported"] == 0

    @pytest.mark.asyncio
    async def test_non_csv_rejected(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.post(
            "/api/v1/import/execute",
            files={"file": ("data.txt", io.BytesIO(b"not csv"), "text/plain")},
            headers=_auth_headers(user.id),
        )
        assert r.status_code == 400

    @pytest.mark.asyncio
    async def test_imported_sessions_created_in_db(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        await client.post(
            "/api/v1/import/execute",
            files=_csv_file(STRONG_CSV),
            headers=_auth_headers(user.id),
        )
        result = await db_session.execute(
            select(TrainingSession).where(TrainingSession.user_id == user.id)
        )
        sessions = list(result.scalars().all())
        assert len(sessions) >= 1

    @pytest.mark.asyncio
    async def test_duplicate_import_skipped(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        await client.post("/api/v1/import/execute", files=_csv_file(STRONG_CSV), headers=_auth_headers(user.id))
        r = await client.post("/api/v1/import/execute", files=_csv_file(STRONG_CSV), headers=_auth_headers(user.id))
        assert r.status_code == 200
        assert r.json()["sessions_imported"] == 0

    @pytest.mark.asyncio
    async def test_response_structure(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.post(
            "/api/v1/import/execute",
            files=_csv_file(STRONG_CSV),
            headers=_auth_headers(user.id),
        )
        body = r.json()
        assert "sessions_imported" in body
        assert "exercises_created" in body
        assert "prs_detected" in body
