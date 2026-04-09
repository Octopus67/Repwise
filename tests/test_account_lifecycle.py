"""Tests for account deletion and reactivation lifecycle."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.middleware.rate_limiter import clear_all
from src.modules.auth.models import User
from src.modules.account.service import AccountService
from src.shared.audit import AuditLog


@pytest.fixture(autouse=True)
def _clear_rate_limiter():
    clear_all()
    yield
    clear_all()


async def _create_user(db: AsyncSession, email: str = "acct@test.com", role: str = "user") -> User:
    user = User(email=email, hashed_password="hashed", auth_provider="email", role=role)
    db.add(user)
    await db.flush()
    return user


def _auth_headers(user_id: uuid.UUID) -> dict:
    import jwt
    from src.config.settings import settings

    token = jwt.encode(
        {"sub": str(user_id), "type": "access", "exp": datetime.now(timezone.utc) + timedelta(hours=1), "iss": "repwise", "aud": "repwise-api"},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    return {"Authorization": f"Bearer {token}"}


class TestDeleteAccountAuth:
    @pytest.mark.asyncio
    async def test_delete_requires_auth(self, client, override_get_db):
        r = await client.delete("/api/v1/account/")
        assert r.status_code == 401

    @pytest.mark.asyncio
    async def test_reactivate_requires_auth(self, client, override_get_db):
        r = await client.post("/api/v1/account/reactivate")
        assert r.status_code == 401


class TestDeleteAccount:
    @pytest.mark.asyncio
    async def test_soft_delete_sets_deleted_at(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.delete("/api/v1/account/", headers=_auth_headers(user.id))
        assert r.status_code == 200
        body = r.json()
        assert body["grace_period_days"] == 30
        assert body["deleted_at"] is not None
        await db_session.refresh(user)
        assert user.deleted_at is not None

    @pytest.mark.asyncio
    async def test_soft_delete_creates_audit_log(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        await client.delete("/api/v1/account/", headers=_auth_headers(user.id))
        result = await db_session.execute(select(AuditLog).where(AuditLog.user_id == user.id))
        logs = list(result.scalars().all())
        assert any(log.changes.get("action") == "account_deletion_requested" for log in logs)

    @pytest.mark.asyncio
    async def test_deleted_user_gets_401(self, client, override_get_db, db_session):
        """After soft delete, auth middleware rejects the user."""
        user = await _create_user(db_session)
        await client.delete("/api/v1/account/", headers=_auth_headers(user.id))
        r = await client.delete("/api/v1/account/", headers=_auth_headers(user.id))
        assert r.status_code == 401

    @pytest.mark.asyncio
    async def test_data_preserved_during_soft_delete(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        original_email = user.email
        await client.delete("/api/v1/account/", headers=_auth_headers(user.id))
        await db_session.refresh(user)
        assert user.email == original_email
        assert user.hashed_password == "hashed"

    @pytest.mark.asyncio
    async def test_delete_response_includes_permanent_date(self, client, override_get_db, db_session):
        user = await _create_user(db_session)
        r = await client.delete("/api/v1/account/", headers=_auth_headers(user.id))
        body = r.json()
        assert "permanent_deletion_date" in body
        assert "message" in body


class TestReactivateService:
    """Test reactivation via service layer (API blocks soft-deleted users at auth)."""

    @pytest.mark.asyncio
    async def test_reactivate_within_grace_period(self, override_get_db, db_session):
        user = await _create_user(db_session)
        svc = AccountService(db_session)
        await svc.request_deletion(user.id)
        result = await svc.reactivate(user.id)
        assert "reactivated" in result["message"].lower()
        await db_session.refresh(user)
        assert user.deleted_at is None

    @pytest.mark.asyncio
    async def test_reactivate_after_grace_period_fails(self, override_get_db, db_session):
        from src.shared.errors import UnprocessableError

        user = await _create_user(db_session)
        user.deleted_at = datetime.now(timezone.utc) - timedelta(days=31)
        await db_session.flush()
        svc = AccountService(db_session)
        with pytest.raises(UnprocessableError):
            await svc.reactivate(user.id)

    @pytest.mark.asyncio
    async def test_reactivate_non_deleted_fails(self, override_get_db, db_session):
        from src.shared.errors import UnprocessableError

        user = await _create_user(db_session)
        svc = AccountService(db_session)
        with pytest.raises(UnprocessableError):
            await svc.reactivate(user.id)

    @pytest.mark.asyncio
    async def test_reactivate_creates_audit_log(self, override_get_db, db_session):
        user = await _create_user(db_session)
        svc = AccountService(db_session)
        await svc.request_deletion(user.id)
        await svc.reactivate(user.id)
        result = await db_session.execute(select(AuditLog).where(AuditLog.user_id == user.id))
        logs = list(result.scalars().all())
        assert any(log.changes.get("action") == "account_reactivated" for log in logs)

    @pytest.mark.asyncio
    async def test_reactivate_clears_deleted_at(self, override_get_db, db_session):
        user = await _create_user(db_session)
        svc = AccountService(db_session)
        await svc.request_deletion(user.id)
        assert user.deleted_at is not None
        await svc.reactivate(user.id)
        assert user.deleted_at is None
