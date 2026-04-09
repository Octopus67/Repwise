"""Tests for health reports endpoints — CRUD, correlations, premium gating."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.auth.models import User
from src.modules.payments.models import Subscription


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_user(db: AsyncSession, email: str = "health@test.com") -> User:
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


def _auth_headers(user_id: uuid.UUID) -> dict:
    import jwt
    from src.config.settings import settings
    token = jwt.encode(
        {"sub": str(user_id), "type": "access", "exp": datetime.now(timezone.utc) + timedelta(hours=1), "iss": "repwise", "aud": "repwise-api"},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    return {"Authorization": f"Bearer {token}"}


SAMPLE_MARKERS = {"hemoglobin": 14.0, "vitamin_d": 25.0, "iron": 80.0}


# ---------------------------------------------------------------------------
# Auth tests
# ---------------------------------------------------------------------------

class TestHealthReportsAuth:
    @pytest.mark.asyncio
    async def test_create_requires_auth(self, client, override_get_db):
        r = await client.post("/api/v1/health-reports/reports", json={"report_date": "2024-01-01", "markers": {}})
        assert r.status_code == 401

    @pytest.mark.asyncio
    async def test_list_requires_auth(self, client, override_get_db):
        r = await client.get("/api/v1/health-reports/reports")
        assert r.status_code == 401

    @pytest.mark.asyncio
    async def test_detail_requires_auth(self, client, override_get_db):
        r = await client.get(f"/api/v1/health-reports/reports/{uuid.uuid4()}")
        assert r.status_code == 401

    @pytest.mark.asyncio
    async def test_correlations_requires_auth(self, client, override_get_db):
        r = await client.get(f"/api/v1/health-reports/reports/{uuid.uuid4()}/correlations")
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Premium gating
# ---------------------------------------------------------------------------

class TestHealthReportsPremiumGating:
    @pytest.mark.asyncio
    async def test_create_requires_premium(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.post(
            "/api/v1/health-reports/reports",
            json={"report_date": "2024-01-01", "markers": {}},
            headers=_auth_headers(user.id),
        )
        assert r.status_code == 403

    @pytest.mark.asyncio
    async def test_list_requires_premium(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.get("/api/v1/health-reports/reports", headers=_auth_headers(user.id))
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# POST /health-reports/reports
# ---------------------------------------------------------------------------

class TestCreateReport:
    @pytest.mark.asyncio
    async def test_create_report(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        await _make_premium(db_session, user)
        r = await client.post(
            "/api/v1/health-reports/reports",
            json={"report_date": "2024-06-15", "markers": SAMPLE_MARKERS},
            headers=_auth_headers(user.id),
        )
        assert r.status_code == 201
        data = r.json()
        assert data["report_date"] == "2024-06-15"
        assert data["is_sample"] is False

    @pytest.mark.asyncio
    async def test_create_flags_markers(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        await _make_premium(db_session, user)
        r = await client.post(
            "/api/v1/health-reports/reports",
            json={"report_date": "2024-06-15", "markers": {"vitamin_d": 10.0}},
            headers=_auth_headers(user.id),
        )
        data = r.json()
        assert data["flagged_markers"] is not None
        assert "vitamin_d" in data["flagged_markers"]
        assert data["flagged_markers"]["vitamin_d"]["status"] == "low"

    @pytest.mark.asyncio
    async def test_create_empty_markers(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        await _make_premium(db_session, user)
        r = await client.post(
            "/api/v1/health-reports/reports",
            json={"report_date": "2024-01-01", "markers": {}},
            headers=_auth_headers(user.id),
        )
        assert r.status_code == 201


# ---------------------------------------------------------------------------
# GET /health-reports/reports
# ---------------------------------------------------------------------------

class TestListReports:
    @pytest.mark.asyncio
    async def test_empty_list(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        await _make_premium(db_session, user)
        r = await client.get("/api/v1/health-reports/reports", headers=_auth_headers(user.id))
        assert r.status_code == 200
        assert r.json()["items"] == []
        assert r.json()["total_count"] == 0

    @pytest.mark.asyncio
    async def test_list_after_create(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        await _make_premium(db_session, user)
        headers = _auth_headers(user.id)
        await client.post("/api/v1/health-reports/reports", json={"report_date": "2024-01-01", "markers": {}}, headers=headers)
        r = await client.get("/api/v1/health-reports/reports", headers=headers)
        assert r.json()["total_count"] == 1

    @pytest.mark.asyncio
    async def test_pagination(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        await _make_premium(db_session, user)
        headers = _auth_headers(user.id)
        for i in range(3):
            await client.post("/api/v1/health-reports/reports", json={"report_date": f"2024-0{i+1}-01", "markers": {}}, headers=headers)
        r = await client.get("/api/v1/health-reports/reports?page=1&limit=2", headers=headers)
        data = r.json()
        assert len(data["items"]) == 2
        assert data["total_count"] == 3


# ---------------------------------------------------------------------------
# GET /health-reports/reports/{id}
# ---------------------------------------------------------------------------

class TestGetReportDetail:
    @pytest.mark.asyncio
    async def test_get_detail(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        await _make_premium(db_session, user)
        headers = _auth_headers(user.id)
        created = (await client.post("/api/v1/health-reports/reports", json={"report_date": "2024-01-01", "markers": SAMPLE_MARKERS}, headers=headers)).json()
        r = await client.get(f"/api/v1/health-reports/reports/{created['id']}", headers=headers)
        assert r.status_code == 200
        assert r.json()["id"] == created["id"]

    @pytest.mark.asyncio
    async def test_not_found(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        await _make_premium(db_session, user)
        r = await client.get(f"/api/v1/health-reports/reports/{uuid.uuid4()}", headers=_auth_headers(user.id))
        assert r.status_code == 404

    @pytest.mark.asyncio
    async def test_idor_prevention(self, client, override_get_db, db_session):
        u1 = await _create_user(db_session, "owner@test.com")
        u2 = await _create_user(db_session, "attacker@test.com")
        await _make_premium(db_session, u1)
        await _make_premium(db_session, u2)
        created = (await client.post("/api/v1/health-reports/reports", json={"report_date": "2024-01-01", "markers": {}}, headers=_auth_headers(u1.id))).json()
        r = await client.get(f"/api/v1/health-reports/reports/{created['id']}", headers=_auth_headers(u2.id))
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# GET /health-reports/reports/{id}/correlations
# ---------------------------------------------------------------------------

class TestCorrelations:
    @pytest.mark.asyncio
    async def test_correlations_empty(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        await _make_premium(db_session, user)
        headers = _auth_headers(user.id)
        created = (await client.post("/api/v1/health-reports/reports", json={"report_date": "2024-01-01", "markers": {"hemoglobin": 14.0}}, headers=headers)).json()
        r = await client.get(f"/api/v1/health-reports/reports/{created['id']}/correlations", headers=headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    @pytest.mark.asyncio
    async def test_correlations_not_found(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        await _make_premium(db_session, user)
        r = await client.get(f"/api/v1/health-reports/reports/{uuid.uuid4()}/correlations", headers=_auth_headers(user.id))
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# GET /health-reports/reports/samples
# ---------------------------------------------------------------------------

class TestSampleReports:
    @pytest.mark.asyncio
    async def test_samples_available_to_free_users(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.get("/api/v1/health-reports/reports/samples", headers=_auth_headers(user.id))
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1
