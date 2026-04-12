"""Tests for Navy body fat calculator, MeasurementService, PhotoService, and router endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest

from src.modules.measurements.navy_calculator import navy_body_fat


# ---------------------------------------------------------------------------
# Navy calculator unit tests
# ---------------------------------------------------------------------------


class TestNavyCalculator:
    def test_male_known_values(self):
        # Male: waist=85, neck=37, height=178
        bf = navy_body_fat("male", waist_cm=85, neck_cm=37, height_cm=178)
        assert 10 < bf < 25

    def test_female_known_values(self):
        bf = navy_body_fat("female", waist_cm=75, neck_cm=32, height_cm=165, hips_cm=95)
        assert 15 < bf < 60

    def test_male_no_hips_needed(self):
        bf = navy_body_fat("male", waist_cm=90, neck_cm=38, height_cm=180)
        assert bf > 0

    def test_female_requires_hips(self):
        with pytest.raises(ValueError, match="hips_cm is required"):
            navy_body_fat("female", waist_cm=75, neck_cm=32, height_cm=165)

    def test_male_waist_less_than_neck_raises(self):
        with pytest.raises(ValueError, match="waist must be greater than neck"):
            navy_body_fat("male", waist_cm=30, neck_cm=40, height_cm=180)

    def test_invalid_sex_raises(self):
        with pytest.raises(ValueError, match="Invalid sex"):
            navy_body_fat("unknown", waist_cm=85, neck_cm=37, height_cm=178)

    def test_result_never_negative(self):
        # Very low body fat scenario
        bf = navy_body_fat("male", waist_cm=65, neck_cm=40, height_cm=190)
        assert bf >= 0

    def test_male_formula_precision(self):
        import math

        waist, neck, height = 85.0, 37.0, 178.0
        expected = (
            495 / (1.0324 - 0.19077 * math.log10(waist - neck) + 0.15456 * math.log10(height)) - 450
        )
        bf = navy_body_fat("male", waist_cm=waist, neck_cm=neck, height_cm=height)
        assert abs(bf - round(max(expected, 0), 2)) < 0.01

    def test_female_formula_precision(self):
        import math

        waist, neck, height, hips = 75.0, 32.0, 165.0, 95.0
        expected = (
            495
            / (1.29579 - 0.35004 * math.log10(waist + hips - neck) + 0.22100 * math.log10(height))
            - 450
        )
        bf = navy_body_fat("female", waist_cm=waist, neck_cm=neck, height_cm=height, hips_cm=hips)
        assert abs(bf - round(max(expected, 0), 2)) < 0.01

    def test_male_hodgdon_beckett_known_case(self):
        """Verify Hodgdon-Beckett produces expected ~18.6% for standard male."""
        bf = navy_body_fat("male", waist_cm=85, neck_cm=37, height_cm=178)
        assert 17.0 < bf < 20.0, f"Expected ~18.6%, got {bf}%"

    def test_female_hodgdon_beckett_known_case(self):
        """Verify Hodgdon-Beckett produces expected ~27.4% for standard female."""
        bf = navy_body_fat("female", waist_cm=75, neck_cm=32, height_cm=165, hips_cm=95)
        assert 25.0 < bf < 30.0, f"Expected ~27.4%, got {bf}%"


# ---------------------------------------------------------------------------
# MeasurementService unit tests
# ---------------------------------------------------------------------------


class TestMeasurementService:
    @pytest.mark.asyncio
    async def test_create_and_get(self, db_session):
        from src.modules.measurements.service import MeasurementService
        from src.modules.measurements.schemas import MeasurementCreate

        user_id = await _create_user(db_session)
        svc = MeasurementService(db_session)

        data = MeasurementCreate(
            measured_at=datetime.now(timezone.utc),
            weight_kg=80.0,
            waist_cm=85.0,
            neck_cm=37.0,
        )
        m = await svc.create(user_id, data)
        assert m.weight_kg == 80.0

        fetched = await svc.get(user_id, m.id)
        assert fetched.id == m.id

    @pytest.mark.asyncio
    async def test_get_latest(self, db_session):
        from src.modules.measurements.service import MeasurementService
        from src.modules.measurements.schemas import MeasurementCreate
        from datetime import timedelta

        user_id = await _create_user(db_session)
        svc = MeasurementService(db_session)

        now = datetime.now(timezone.utc)
        await svc.create(
            user_id, MeasurementCreate(measured_at=now - timedelta(days=1), weight_kg=79.0)
        )
        m2 = await svc.create(user_id, MeasurementCreate(measured_at=now, weight_kg=80.0))

        latest = await svc.get_latest(user_id)
        assert latest.id == m2.id

    @pytest.mark.asyncio
    async def test_get_latest_empty_raises(self, db_session):
        from src.modules.measurements.service import MeasurementService
        from src.shared.errors import NotFoundError

        user_id = await _create_user(db_session)
        svc = MeasurementService(db_session)

        with pytest.raises(NotFoundError):
            await svc.get_latest(user_id)

    @pytest.mark.asyncio
    async def test_update(self, db_session):
        from src.modules.measurements.service import MeasurementService
        from src.modules.measurements.schemas import MeasurementCreate, MeasurementUpdate

        user_id = await _create_user(db_session)
        svc = MeasurementService(db_session)

        m = await svc.create(
            user_id,
            MeasurementCreate(
                measured_at=datetime.now(timezone.utc),
                weight_kg=80.0,
            ),
        )
        updated = await svc.update(user_id, m.id, MeasurementUpdate(weight_kg=82.0))
        assert updated.weight_kg == 82.0

    @pytest.mark.asyncio
    async def test_delete(self, db_session):
        from src.modules.measurements.service import MeasurementService
        from src.modules.measurements.schemas import MeasurementCreate
        from src.shared.errors import NotFoundError

        user_id = await _create_user(db_session)
        svc = MeasurementService(db_session)

        m = await svc.create(
            user_id,
            MeasurementCreate(
                measured_at=datetime.now(timezone.utc),
                weight_kg=80.0,
            ),
        )
        await svc.delete(user_id, m.id)

        with pytest.raises(NotFoundError):
            await svc.get(user_id, m.id)

    @pytest.mark.asyncio
    async def test_get_trend(self, db_session):
        from src.modules.measurements.service import MeasurementService
        from src.modules.measurements.schemas import MeasurementCreate
        from datetime import timedelta

        user_id = await _create_user(db_session)
        svc = MeasurementService(db_session)

        now = datetime.now(timezone.utc)
        for i in range(5):
            await svc.create(
                user_id,
                MeasurementCreate(
                    measured_at=now - timedelta(days=i),
                    weight_kg=80.0 - i,
                ),
            )

        trend = await svc.get_trend(user_id, days=90)
        assert len(trend) == 5
        # Should be ascending by date
        assert trend[0].measured_at < trend[-1].measured_at

    @pytest.mark.asyncio
    async def test_list_paginated(self, db_session):
        from src.modules.measurements.service import MeasurementService
        from src.modules.measurements.schemas import MeasurementCreate
        from src.shared.pagination import PaginationParams
        from datetime import timedelta

        user_id = await _create_user(db_session)
        svc = MeasurementService(db_session)

        now = datetime.now(timezone.utc)
        for i in range(5):
            await svc.create(
                user_id,
                MeasurementCreate(
                    measured_at=now - timedelta(days=i),
                    weight_kg=80.0,
                ),
            )

        result = await svc.list(user_id, PaginationParams(page=1, limit=2))
        assert result.total_count == 5
        assert len(result.items) == 2

    @pytest.mark.asyncio
    async def test_get_nonexistent_raises(self, db_session):
        from src.modules.measurements.service import MeasurementService
        from src.shared.errors import NotFoundError

        user_id = await _create_user(db_session)
        svc = MeasurementService(db_session)

        with pytest.raises(NotFoundError):
            await svc.get(user_id, uuid.uuid4())


# ---------------------------------------------------------------------------
# PhotoService unit tests
# ---------------------------------------------------------------------------


class TestPhotoService:
    @pytest.mark.asyncio
    async def test_upload_and_get(self, db_session, tmp_path, monkeypatch):
        import src.modules.measurements.photo_service as ps

        monkeypatch.setattr(ps, "UPLOAD_ROOT", str(tmp_path))

        from src.modules.measurements.photo_service import PhotoService
        from src.modules.measurements.service import MeasurementService
        from src.modules.measurements.schemas import MeasurementCreate, PhotoUpload

        user_id = await _create_user(db_session)
        m_svc = MeasurementService(db_session)
        m = await m_svc.create(
            user_id,
            MeasurementCreate(
                measured_at=datetime.now(timezone.utc),
                weight_kg=80.0,
            ),
        )

        p_svc = PhotoService(db_session)
        photo = await p_svc.upload(
            user_id=user_id,
            measurement_id=m.id,
            file_bytes=b"\xff\xd8\xff" + b"\x00" * 100,
            metadata=PhotoUpload(
                photo_type="front",
                taken_at=datetime.now(timezone.utc),
            ),
            content_type="image/jpeg",
        )
        assert photo.photo_type == "front"
        assert photo.photo_url.endswith(".jpg")

        fetched = await p_svc.get(user_id, photo.id)
        assert fetched.id == photo.id

    @pytest.mark.asyncio
    async def test_delete_removes_file(self, db_session, tmp_path, monkeypatch):
        import os
        import src.modules.measurements.photo_service as ps

        monkeypatch.setattr(ps, "UPLOAD_ROOT", str(tmp_path))

        from src.modules.measurements.photo_service import PhotoService
        from src.modules.measurements.service import MeasurementService
        from src.modules.measurements.schemas import MeasurementCreate, PhotoUpload
        from src.shared.errors import NotFoundError

        user_id = await _create_user(db_session)
        m_svc = MeasurementService(db_session)
        m = await m_svc.create(
            user_id,
            MeasurementCreate(
                measured_at=datetime.now(timezone.utc),
                weight_kg=80.0,
            ),
        )

        p_svc = PhotoService(db_session)
        photo = await p_svc.upload(
            user_id=user_id,
            measurement_id=m.id,
            file_bytes=b"\xff\xd8\xff" + b"\x00" * 100,
            metadata=PhotoUpload(photo_type="back", taken_at=datetime.now(timezone.utc)),
            content_type="image/jpeg",
        )

        # File should exist
        filepath = os.path.join(str(tmp_path), photo.photo_url.lstrip("/"))
        assert os.path.exists(filepath)

        await p_svc.delete(user_id, photo.id)

        # File should be gone
        assert not os.path.exists(filepath)

        with pytest.raises(NotFoundError):
            await p_svc.get(user_id, photo.id)

    @pytest.mark.asyncio
    async def test_upload_rejects_oversized_file(self, db_session, tmp_path, monkeypatch):
        import src.modules.measurements.photo_service as ps

        monkeypatch.setattr(ps, "UPLOAD_ROOT", str(tmp_path))

        from src.modules.measurements.photo_service import PhotoService
        from src.modules.measurements.service import MeasurementService
        from src.modules.measurements.schemas import MeasurementCreate, PhotoUpload
        from src.shared.errors import ValidationError

        user_id = await _create_user(db_session)
        m_svc = MeasurementService(db_session)
        m = await m_svc.create(
            user_id,
            MeasurementCreate(
                measured_at=datetime.now(timezone.utc),
                weight_kg=80.0,
            ),
        )

        p_svc = PhotoService(db_session)
        oversized = b"\xff\xd8\xff" + b"\x00" * (6 * 1024 * 1024)
        with pytest.raises(ValidationError, match="maximum size"):
            await p_svc.upload(
                user_id=user_id,
                measurement_id=m.id,
                file_bytes=oversized,
                metadata=PhotoUpload(photo_type="front", taken_at=datetime.now(timezone.utc)),
                content_type="image/jpeg",
            )

    @pytest.mark.asyncio
    async def test_upload_rejects_bad_content_type(self, db_session, tmp_path, monkeypatch):
        import src.modules.measurements.photo_service as ps

        monkeypatch.setattr(ps, "UPLOAD_ROOT", str(tmp_path))

        from src.modules.measurements.photo_service import PhotoService
        from src.modules.measurements.service import MeasurementService
        from src.modules.measurements.schemas import MeasurementCreate, PhotoUpload
        from src.shared.errors import ValidationError

        user_id = await _create_user(db_session)
        m_svc = MeasurementService(db_session)
        m = await m_svc.create(
            user_id,
            MeasurementCreate(
                measured_at=datetime.now(timezone.utc),
                weight_kg=80.0,
            ),
        )

        p_svc = PhotoService(db_session)
        with pytest.raises(ValidationError, match="not allowed"):
            await p_svc.upload(
                user_id=user_id,
                measurement_id=m.id,
                file_bytes=b"GIF89a" + b"\x00" * 100,
                metadata=PhotoUpload(photo_type="front", taken_at=datetime.now(timezone.utc)),
                content_type="image/gif",
            )

    @pytest.mark.asyncio
    async def test_upload_rejects_magic_byte_mismatch(self, db_session, tmp_path, monkeypatch):
        import src.modules.measurements.photo_service as ps

        monkeypatch.setattr(ps, "UPLOAD_ROOT", str(tmp_path))

        from src.modules.measurements.photo_service import PhotoService
        from src.modules.measurements.service import MeasurementService
        from src.modules.measurements.schemas import MeasurementCreate, PhotoUpload
        from src.shared.errors import ValidationError

        user_id = await _create_user(db_session)
        m_svc = MeasurementService(db_session)
        m = await m_svc.create(
            user_id,
            MeasurementCreate(
                measured_at=datetime.now(timezone.utc),
                weight_kg=80.0,
            ),
        )

        p_svc = PhotoService(db_session)
        # Claims JPEG but has PNG magic bytes
        with pytest.raises(ValidationError, match="does not match"):
            await p_svc.upload(
                user_id=user_id,
                measurement_id=m.id,
                file_bytes=b"\x89PNG\r\n\x1a\n" + b"\x00" * 100,
                metadata=PhotoUpload(photo_type="front", taken_at=datetime.now(timezone.utc)),
                content_type="image/jpeg",
            )

    @pytest.mark.asyncio
    async def test_upload_png_accepted(self, db_session, tmp_path, monkeypatch):
        import src.modules.measurements.photo_service as ps

        monkeypatch.setattr(ps, "UPLOAD_ROOT", str(tmp_path))

        from src.modules.measurements.photo_service import PhotoService
        from src.modules.measurements.service import MeasurementService
        from src.modules.measurements.schemas import MeasurementCreate, PhotoUpload

        user_id = await _create_user(db_session)
        m_svc = MeasurementService(db_session)
        m = await m_svc.create(
            user_id,
            MeasurementCreate(
                measured_at=datetime.now(timezone.utc),
                weight_kg=80.0,
            ),
        )

        p_svc = PhotoService(db_session)
        photo = await p_svc.upload(
            user_id=user_id,
            measurement_id=m.id,
            file_bytes=b"\x89PNG\r\n\x1a\n" + b"\x00" * 100,
            metadata=PhotoUpload(photo_type="front", taken_at=datetime.now(timezone.utc)),
            content_type="image/png",
        )
        assert photo.photo_url.endswith(".png")

    @pytest.mark.asyncio
    async def test_get_nonexistent_raises(self, db_session):
        from src.modules.measurements.photo_service import PhotoService
        from src.shared.errors import NotFoundError

        user_id = await _create_user(db_session)
        p_svc = PhotoService(db_session)

        with pytest.raises(NotFoundError):
            await p_svc.get(user_id, uuid.uuid4())


# ---------------------------------------------------------------------------
# Router / endpoint tests
# ---------------------------------------------------------------------------


class TestMeasurementEndpoints:
    @pytest.mark.asyncio
    async def test_create_measurement(self, override_get_db, client):
        headers = await _register_and_get_headers(client)
        resp = await client.post(
            "/api/v1/body-measurements",
            json={
                "measured_at": datetime.now(timezone.utc).isoformat(),
                "weight_kg": 80.0,
                "waist_cm": 85.0,
                "neck_cm": 37.0,
            },
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["weight_kg"] == 80.0
        assert data["waist_cm"] == 85.0

    @pytest.mark.asyncio
    async def test_list_measurements(self, override_get_db, client):
        headers = await _register_and_get_headers(client)
        # Create one
        await client.post(
            "/api/v1/body-measurements",
            json={"measured_at": datetime.now(timezone.utc).isoformat(), "weight_kg": 80.0},
            headers=headers,
        )
        resp = await client.get("/api/v1/body-measurements", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["total_count"] >= 1

    @pytest.mark.asyncio
    async def test_get_latest(self, override_get_db, client):
        headers = await _register_and_get_headers(client)
        await client.post(
            "/api/v1/body-measurements",
            json={"measured_at": datetime.now(timezone.utc).isoformat(), "weight_kg": 81.0},
            headers=headers,
        )
        resp = await client.get("/api/v1/body-measurements/latest", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["weight_kg"] == 81.0

    @pytest.mark.asyncio
    async def test_get_by_id(self, override_get_db, client):
        headers = await _register_and_get_headers(client)
        create_resp = await client.post(
            "/api/v1/body-measurements",
            json={"measured_at": datetime.now(timezone.utc).isoformat(), "weight_kg": 82.0},
            headers=headers,
        )
        mid = create_resp.json()["id"]
        resp = await client.get(f"/api/v1/body-measurements/{mid}", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == mid

    @pytest.mark.asyncio
    async def test_update_measurement(self, override_get_db, client):
        headers = await _register_and_get_headers(client)
        create_resp = await client.post(
            "/api/v1/body-measurements",
            json={"measured_at": datetime.now(timezone.utc).isoformat(), "weight_kg": 80.0},
            headers=headers,
        )
        assert create_resp.status_code == 201
        mid = create_resp.json()["id"]
        resp = await client.put(
            f"/api/v1/body-measurements/{mid}",
            json={"weight_kg": 83.0},
            headers=headers,
        )
        assert resp.status_code == 200, f"Update failed: {resp.text}"
        assert resp.json()["weight_kg"] == 83.0

    @pytest.mark.asyncio
    async def test_delete_measurement(self, override_get_db, client):
        headers = await _register_and_get_headers(client)
        create_resp = await client.post(
            "/api/v1/body-measurements",
            json={"measured_at": datetime.now(timezone.utc).isoformat(), "weight_kg": 80.0},
            headers=headers,
        )
        mid = create_resp.json()["id"]
        resp = await client.delete(f"/api/v1/body-measurements/{mid}", headers=headers)
        assert resp.status_code == 204

        # Verify gone
        resp = await client.get(f"/api/v1/body-measurements/{mid}", headers=headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_trend(self, override_get_db, client):
        headers = await _register_and_get_headers(client)
        await client.post(
            "/api/v1/body-measurements",
            json={"measured_at": datetime.now(timezone.utc).isoformat(), "weight_kg": 80.0},
            headers=headers,
        )
        resp = await client.get("/api/v1/body-measurements/trend", headers=headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_unauthenticated_returns_401(self, override_get_db, client):
        resp = await client.get("/api/v1/body-measurements")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_validation_weight_negative(self, override_get_db, client):
        headers = await _register_and_get_headers(client)
        resp = await client.post(
            "/api/v1/body-measurements",
            json={"measured_at": datetime.now(timezone.utc).isoformat(), "weight_kg": -5},
            headers=headers,
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_validation_body_fat_over_100(self, override_get_db, client):
        headers = await _register_and_get_headers(client)
        resp = await client.post(
            "/api/v1/body-measurements",
            json={"measured_at": datetime.now(timezone.utc).isoformat(), "body_fat_pct": 101},
            headers=headers,
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Schema validation tests
# ---------------------------------------------------------------------------


class TestSchemaValidation:
    def test_measurement_create_valid(self):
        from src.modules.measurements.schemas import MeasurementCreate

        m = MeasurementCreate(
            measured_at=datetime.now(timezone.utc),
            weight_kg=80.0,
            body_fat_pct=15.0,
            waist_cm=85.0,
        )
        assert m.weight_kg == 80.0

    def test_measurement_create_rejects_negative_weight(self):
        from src.modules.measurements.schemas import MeasurementCreate

        with pytest.raises(Exception):
            MeasurementCreate(measured_at=datetime.now(timezone.utc), weight_kg=-1)

    def test_measurement_create_rejects_bf_over_100(self):
        from src.modules.measurements.schemas import MeasurementCreate

        with pytest.raises(Exception):
            MeasurementCreate(measured_at=datetime.now(timezone.utc), body_fat_pct=101)

    def test_measurement_create_rejects_negative_cm(self):
        from src.modules.measurements.schemas import MeasurementCreate

        with pytest.raises(Exception):
            MeasurementCreate(measured_at=datetime.now(timezone.utc), waist_cm=-5)

    def test_photo_upload_valid_types(self):
        from src.modules.measurements.schemas import PhotoUpload

        for t in ("front", "side", "back", "other"):
            p = PhotoUpload(photo_type=t, taken_at=datetime.now(timezone.utc))
            assert p.photo_type == t

    def test_photo_upload_invalid_type(self):
        from src.modules.measurements.schemas import PhotoUpload

        with pytest.raises(Exception):
            PhotoUpload(photo_type="top", taken_at=datetime.now(timezone.utc))

    def test_navy_bf_request_female_requires_hips(self):
        from src.modules.measurements.schemas import NavyBFRequest

        with pytest.raises(Exception):
            NavyBFRequest(sex="female", waist_cm=75, neck_cm=32, height_cm=165)

    def test_navy_bf_request_male_no_hips(self):
        from src.modules.measurements.schemas import NavyBFRequest

        r = NavyBFRequest(sex="male", waist_cm=85, neck_cm=37, height_cm=178)
        assert r.hips_cm is None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_user(session) -> uuid.UUID:
    """Create a minimal user row and return its ID."""
    from src.modules.auth.models import User

    user = User(
        email=f"test-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="fakehash",
        auth_provider="email",
        role="user",
    )
    session.add(user)
    await session.flush()
    return user.id


async def _register_and_get_headers(client) -> dict:
    """Register a user via the API and return auth headers."""
    email = f"test-{uuid.uuid4().hex[:8]}@example.com"
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "TestPass123!"},
    )
    assert resp.status_code == 201, f"Registration failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
