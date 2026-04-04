"""Tests for data export feature — GDPR Article 20 compliance.

Covers: models, schemas, service, router, background worker, cleanup job.
"""

from __future__ import annotations

import json
import os
import shutil
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.auth.models import User
from src.modules.export.models import ExportRequest
from src.modules.export.schemas import ExportRequestCreate, ExportRequestResponse
from src.modules.export.service import ExportService, EXPORTS_DIR, EXPORT_EXPIRY_DAYS, RATE_LIMIT_HOURS
from src.shared.errors import NotFoundError, RateLimitedError, UnprocessableError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_user(db: AsyncSession, email: str = "export@test.com") -> User:
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
# Schema tests
# ---------------------------------------------------------------------------

class TestExportSchemas:
    def test_valid_json_format(self):
        req = ExportRequestCreate(format="json")
        assert req.format == "json"

    def test_valid_csv_format(self):
        req = ExportRequestCreate(format="csv")
        assert req.format == "csv"

    def test_valid_pdf_format(self):
        req = ExportRequestCreate(format="pdf")
        assert req.format == "pdf"

    def test_case_insensitive_format(self):
        req = ExportRequestCreate(format="JSON")
        assert req.format == "json"

    def test_invalid_format_rejected(self):
        with pytest.raises(Exception):
            ExportRequestCreate(format="xml")

    def test_response_schema_from_attributes(self):
        resp = ExportRequestResponse(
            id="abc", format="json", status="pending",
            requested_at=datetime.now(timezone.utc),
        )
        assert resp.status == "pending"


# ---------------------------------------------------------------------------
# Model tests
# ---------------------------------------------------------------------------

class TestExportModel:
    @pytest.mark.asyncio
    async def test_create_export_request(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        export = ExportRequest(
            user_id=user.id, format="json", status="pending",
            requested_at=datetime.now(timezone.utc),
        )
        db_session.add(export)
        await db_session.flush()
        assert export.id is not None
        assert export.status == "pending"

    @pytest.mark.asyncio
    async def test_export_fields_nullable(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        export = ExportRequest(
            user_id=user.id, format="csv", status="pending",
            requested_at=datetime.now(timezone.utc),
        )
        db_session.add(export)
        await db_session.flush()
        assert export.download_url is None
        assert export.file_size_bytes is None
        assert export.error_message is None
        assert export.completed_at is None
        assert export.expires_at is None
        assert export.downloaded_at is None


# ---------------------------------------------------------------------------
# Service tests
# ---------------------------------------------------------------------------

class TestExportServiceRequestExport:
    @pytest.mark.asyncio
    async def test_request_export_creates_pending(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        svc = ExportService(db_session)
        export = await svc.request_export(user.id, "json")
        assert export.status == "pending"
        assert export.format == "json"
        assert export.user_id == user.id

    @pytest.mark.asyncio
    async def test_rate_limit_blocks_second_request(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        svc = ExportService(db_session)
        await svc.request_export(user.id, "json")
        with pytest.raises(RateLimitedError):
            await svc.request_export(user.id, "csv")

    @pytest.mark.asyncio
    async def test_rate_limit_allows_after_24h(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        old = ExportRequest(
            user_id=user.id, format="json", status="completed",
            requested_at=datetime.now(timezone.utc) - timedelta(hours=25),
        )
        db_session.add(old)
        await db_session.flush()
        svc = ExportService(db_session)
        export = await svc.request_export(user.id, "csv")
        assert export.format == "csv"

    @pytest.mark.asyncio
    async def test_rate_limit_ignores_failed_exports(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        failed = ExportRequest(
            user_id=user.id, format="json", status="failed",
            requested_at=datetime.now(timezone.utc),
        )
        db_session.add(failed)
        await db_session.flush()
        svc = ExportService(db_session)
        export = await svc.request_export(user.id, "json")
        assert export.status == "pending"


class TestExportServiceGetExport:
    @pytest.mark.asyncio
    async def test_get_export_returns_correct(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        svc = ExportService(db_session)
        export = await svc.request_export(user.id, "json")
        fetched = await svc.get_export(export.id, user.id)
        assert fetched.id == export.id

    @pytest.mark.asyncio
    async def test_get_export_wrong_user_raises(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        other = await _create_user(db_session, "other@test.com")
        svc = ExportService(db_session)
        export = await svc.request_export(user.id, "json")
        with pytest.raises(NotFoundError):
            await svc.get_export(export.id, other.id)

    @pytest.mark.asyncio
    async def test_get_nonexistent_raises(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        svc = ExportService(db_session)
        with pytest.raises(NotFoundError):
            await svc.get_export(uuid.uuid4(), user.id)


class TestExportServiceHistory:
    @pytest.mark.asyncio
    async def test_history_returns_user_exports(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        for fmt in ["json", "csv"]:
            db_session.add(ExportRequest(
                user_id=user.id, format=fmt, status="completed",
                requested_at=datetime.now(timezone.utc) - timedelta(days=2),
            ))
        await db_session.flush()
        svc = ExportService(db_session)
        history = await svc.get_history(user.id)
        assert len(history) == 2

    @pytest.mark.asyncio
    async def test_history_excludes_other_users(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        other = await _create_user(db_session, "other@test.com")
        db_session.add(ExportRequest(
            user_id=other.id, format="json", status="completed",
            requested_at=datetime.now(timezone.utc) - timedelta(days=2),
        ))
        await db_session.flush()
        svc = ExportService(db_session)
        history = await svc.get_history(user.id)
        assert len(history) == 0

    @pytest.mark.asyncio
    async def test_history_ordered_newest_first(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        now = datetime.now(timezone.utc)
        for i in range(3):
            db_session.add(ExportRequest(
                user_id=user.id, format="json", status="completed",
                requested_at=now - timedelta(days=i + 2),
            ))
        await db_session.flush()
        svc = ExportService(db_session)
        history = await svc.get_history(user.id)
        dates = [e.requested_at for e in history]
        assert dates == sorted(dates, reverse=True)


class TestExportServiceDelete:
    @pytest.mark.asyncio
    async def test_delete_removes_export(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        svc = ExportService(db_session)
        export = await svc.request_export(user.id, "json")
        await svc.delete_export(export.id, user.id)
        with pytest.raises(NotFoundError):
            await svc.get_export(export.id, user.id)

    @pytest.mark.asyncio
    async def test_delete_removes_file(self, db_session: AsyncSession, tmp_path: Path):
        user = await _create_user(db_session)
        export = ExportRequest(
            user_id=user.id, format="json", status="completed",
            requested_at=datetime.now(timezone.utc),
            download_url=str(tmp_path / "test.json"),
        )
        (tmp_path / "test.json").write_text("{}")
        db_session.add(export)
        await db_session.flush()
        svc = ExportService(db_session)
        await svc.delete_export(export.id, user.id)
        assert not (tmp_path / "test.json").exists()


class TestExportServiceMarkDownloaded:
    @pytest.mark.asyncio
    async def test_mark_downloaded_sets_timestamp(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        export = ExportRequest(
            user_id=user.id, format="json", status="completed",
            requested_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        db_session.add(export)
        await db_session.flush()
        svc = ExportService(db_session)
        result = await svc.mark_downloaded(export.id, user.id)
        assert result.downloaded_at is not None

    @pytest.mark.asyncio
    async def test_mark_downloaded_pending_raises(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        svc = ExportService(db_session)
        export = await svc.request_export(user.id, "json")
        with pytest.raises(UnprocessableError):
            await svc.mark_downloaded(export.id, user.id)

    @pytest.mark.asyncio
    async def test_mark_downloaded_expired_raises(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        export = ExportRequest(
            user_id=user.id, format="json", status="completed",
            requested_at=datetime.now(timezone.utc) - timedelta(days=10),
            expires_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
        db_session.add(export)
        await db_session.flush()
        svc = ExportService(db_session)
        with pytest.raises(UnprocessableError):
            await svc.mark_downloaded(export.id, user.id)


class TestExportGeneration:
    @pytest.mark.asyncio
    async def test_generate_json_export(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        svc = ExportService(db_session)
        export = await svc.request_export(user.id, "json")
        await svc.generate_export(export.id)
        await db_session.refresh(export)
        assert export.status == "completed"
        assert export.download_url is not None
        assert export.file_size_bytes > 0
        assert export.expires_at is not None
        # Verify JSON is valid
        with open(export.download_url) as f:
            data = json.load(f)
        assert "profile" in data or "bodyweight_logs" in data
        # Cleanup
        Path(export.download_url).unlink(missing_ok=True)
        shutil.rmtree(EXPORTS_DIR / str(user.id), ignore_errors=True)

    @pytest.mark.asyncio
    async def test_generate_csv_export(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        svc = ExportService(db_session)
        export = await svc.request_export(user.id, "csv")
        await svc.generate_export(export.id)
        await db_session.refresh(export)
        assert export.status == "completed"
        assert export.download_url.endswith(".zip")
        Path(export.download_url).unlink(missing_ok=True)
        shutil.rmtree(EXPORTS_DIR / str(user.id), ignore_errors=True)

    @pytest.mark.asyncio
    async def test_generate_pdf_export(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        svc = ExportService(db_session)
        export = await svc.request_export(user.id, "pdf")
        await svc.generate_export(export.id)
        await db_session.refresh(export)
        assert export.status == "completed"
        assert export.download_url.endswith(".pdf")
        Path(export.download_url).unlink(missing_ok=True)
        shutil.rmtree(EXPORTS_DIR / str(user.id), ignore_errors=True)

    @pytest.mark.asyncio
    async def test_generate_nonexistent_export_noop(self, db_session: AsyncSession):
        svc = ExportService(db_session)
        await svc.generate_export(uuid.uuid4())  # Should not raise

    @pytest.mark.asyncio
    async def test_generate_sets_processing_then_completed(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        svc = ExportService(db_session)
        export = await svc.request_export(user.id, "json")
        assert export.status == "pending"
        await svc.generate_export(export.id)
        await db_session.refresh(export)
        assert export.status == "completed"
        Path(export.download_url).unlink(missing_ok=True)
        shutil.rmtree(EXPORTS_DIR / str(user.id), ignore_errors=True)


# ---------------------------------------------------------------------------
# Router tests
# ---------------------------------------------------------------------------

class TestExportRouter:
    @pytest.mark.asyncio
    async def test_request_export_unauthenticated(self, override_get_db, client):
        resp = await client.post("/api/v1/export/request", json={"format": "json"})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_request_export_invalid_format(self, db_session, override_get_db, client):
        user = await _create_user(db_session)
        resp = await client.post(
            "/api/v1/export/request",
            json={"format": "xml"},
            headers=_auth_headers(user.id),
        )
        assert resp.status_code in (400, 422)

    @pytest.mark.asyncio
    async def test_request_export_success(self, db_session, override_get_db, client):
        user = await _create_user(db_session)
        resp = await client.post(
            "/api/v1/export/request",
            json={"format": "json"},
            headers=_auth_headers(user.id),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "pending"
        assert data["format"] == "json"

    @pytest.mark.asyncio
    async def test_get_status_success(self, db_session, override_get_db, client):
        user = await _create_user(db_session)
        create_resp = await client.post(
            "/api/v1/export/request",
            json={"format": "json"},
            headers=_auth_headers(user.id),
        )
        export_id = create_resp.json()["id"]
        resp = await client.get(
            f"/api/v1/export/status/{export_id}",
            headers=_auth_headers(user.id),
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_get_status_not_found(self, db_session, override_get_db, client):
        user = await _create_user(db_session)
        resp = await client.get(
            f"/api/v1/export/status/{uuid.uuid4()}",
            headers=_auth_headers(user.id),
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_history_empty(self, db_session, override_get_db, client):
        user = await _create_user(db_session)
        resp = await client.get(
            "/api/v1/export/history",
            headers=_auth_headers(user.id),
        )
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_get_history_returns_exports(self, db_session, override_get_db, client):
        user = await _create_user(db_session)
        await client.post(
            "/api/v1/export/request",
            json={"format": "json"},
            headers=_auth_headers(user.id),
        )
        resp = await client.get(
            "/api/v1/export/history",
            headers=_auth_headers(user.id),
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @pytest.mark.asyncio
    async def test_delete_export_success(self, db_session, override_get_db, client):
        user = await _create_user(db_session)
        create_resp = await client.post(
            "/api/v1/export/request",
            json={"format": "json"},
            headers=_auth_headers(user.id),
        )
        export_id = create_resp.json()["id"]
        resp = await client.delete(
            f"/api/v1/export/{export_id}",
            headers=_auth_headers(user.id),
        )
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_export_not_found(self, db_session, override_get_db, client):
        user = await _create_user(db_session)
        resp = await client.delete(
            f"/api/v1/export/{uuid.uuid4()}",
            headers=_auth_headers(user.id),
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_rate_limit_on_second_request(self, db_session, override_get_db, client):
        user = await _create_user(db_session)
        headers = _auth_headers(user.id)
        await client.post("/api/v1/export/request", json={"format": "json"}, headers=headers)
        resp = await client.post("/api/v1/export/request", json={"format": "csv"}, headers=headers)
        assert resp.status_code == 429


# ---------------------------------------------------------------------------
# Background worker tests
# ---------------------------------------------------------------------------

class TestExportWorker:
    @pytest.mark.asyncio
    async def test_worker_processes_pending(self, db_session: AsyncSession):
        from src.jobs.export_worker import run_export_worker
        user = await _create_user(db_session)
        export = ExportRequest(
            user_id=user.id, format="json", status="pending",
            requested_at=datetime.now(timezone.utc),
        )
        db_session.add(export)
        await db_session.flush()
        processed = await run_export_worker(db_session)
        assert processed == 1
        await db_session.refresh(export)
        assert export.status == "completed"
        # Cleanup
        if export.download_url:
            Path(export.download_url).unlink(missing_ok=True)
            shutil.rmtree(EXPORTS_DIR / str(user.id), ignore_errors=True)

    @pytest.mark.asyncio
    async def test_worker_skips_non_pending(self, db_session: AsyncSession):
        from src.jobs.export_worker import run_export_worker
        user = await _create_user(db_session)
        export = ExportRequest(
            user_id=user.id, format="json", status="completed",
            requested_at=datetime.now(timezone.utc),
        )
        db_session.add(export)
        await db_session.flush()
        processed = await run_export_worker(db_session)
        assert processed == 0


# ---------------------------------------------------------------------------
# Cleanup job tests
# ---------------------------------------------------------------------------

class TestCleanupExports:
    @pytest.mark.asyncio
    async def test_cleanup_removes_expired(self, db_session: AsyncSession, tmp_path: Path):
        from src.jobs.cleanup_exports import run_cleanup_exports
        user = await _create_user(db_session)
        file_path = tmp_path / "expired.json"
        file_path.write_text("{}")
        export = ExportRequest(
            user_id=user.id, format="json", status="completed",
            requested_at=datetime.now(timezone.utc) - timedelta(days=10),
            expires_at=datetime.now(timezone.utc) - timedelta(days=1),
            download_url=str(file_path),
        )
        db_session.add(export)
        await db_session.flush()
        cleaned = await run_cleanup_exports(db_session)
        assert cleaned == 1
        assert not file_path.exists()

    @pytest.mark.asyncio
    async def test_cleanup_keeps_non_expired(self, db_session: AsyncSession):
        from src.jobs.cleanup_exports import run_cleanup_exports
        user = await _create_user(db_session)
        export = ExportRequest(
            user_id=user.id, format="json", status="completed",
            requested_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(days=5),
        )
        db_session.add(export)
        await db_session.flush()
        cleaned = await run_cleanup_exports(db_session)
        assert cleaned == 0

    @pytest.mark.asyncio
    async def test_cleanup_handles_missing_file(self, db_session: AsyncSession):
        from src.jobs.cleanup_exports import run_cleanup_exports
        user = await _create_user(db_session)
        export = ExportRequest(
            user_id=user.id, format="json", status="completed",
            requested_at=datetime.now(timezone.utc) - timedelta(days=10),
            expires_at=datetime.now(timezone.utc) - timedelta(days=1),
            download_url="/nonexistent/path.json",
        )
        db_session.add(export)
        await db_session.flush()
        cleaned = await run_cleanup_exports(db_session)
        assert cleaned == 1  # Still removes the DB record


# ---------------------------------------------------------------------------
# Data collection tests
# ---------------------------------------------------------------------------

class TestDataCollection:
    @pytest.mark.asyncio
    async def test_collect_empty_user_data(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        svc = ExportService(db_session)
        data = await svc._collect_user_data(user.id)
        assert "bodyweight_logs" in data
        assert "sessions" in data
        assert "nutrition_entries" in data
        assert "measurements" in data
        assert "progress_photos" in data
        assert "achievements" in data
        assert "goals" in data

    @pytest.mark.asyncio
    async def test_collect_includes_all_categories(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        svc = ExportService(db_session)
        data = await svc._collect_user_data(user.id)
        expected_keys = {"bodyweight_logs", "sessions", "nutrition_entries", "measurements", "progress_photos", "achievements", "goals"}
        assert expected_keys.issubset(set(data.keys()))
