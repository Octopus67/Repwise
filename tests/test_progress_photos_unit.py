"""Unit tests for progress photo feature — schemas, service, and edge cases.

Covers:
- Input validation (bodyweight range, notes length, capture_date future guard, pose_type)
- CRUD operations (create, get, list, update, delete)
- Edge cases (no photos, single photo, date range queries, soft-delete)
- Comparison logic helpers
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

import pytest
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.progress_photos.models import ProgressPhoto
from src.modules.progress_photos.schemas import (
    AlignmentData,
    MAX_BODYWEIGHT_KG,
    MAX_FUTURE_DAYS,
    MAX_NOTES_LENGTH,
    MIN_BODYWEIGHT_KG,
    PhotoCreate,
    PhotoResponse,
    PhotoUpdate,
)
from src.modules.progress_photos.service import ProgressPhotoService
from src.modules.auth.models import User
from src.modules.user.models import BodyweightLog
from src.shared.errors import NotFoundError
from src.shared.pagination import PaginationParams


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_user(db: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"unit-{uuid.uuid4().hex[:8]}@test.com",
        hashed_password="fakehash",
    )
    db.add(user)
    await db.flush()
    return user


async def _create_bodyweight(
    db: AsyncSession, user_id: uuid.UUID, weight: float, recorded: date,
) -> BodyweightLog:
    log = BodyweightLog(user_id=user_id, weight_kg=weight, recorded_date=recorded)
    db.add(log)
    await db.flush()
    return log


# ===========================================================================
# Schema validation tests
# ===========================================================================


class TestPhotoCreateValidation:
    """Validate PhotoCreate schema constraints."""

    def test_valid_minimal_create(self):
        data = PhotoCreate(capture_date=date.today())
        assert data.pose_type == "front_relaxed"
        assert data.bodyweight_kg is None
        assert data.notes is None

    def test_valid_full_create(self):
        data = PhotoCreate(
            capture_date=date.today(),
            bodyweight_kg=80.0,
            pose_type="back",
            notes="Morning photo",
            alignment_data=AlignmentData(centerX=0.5, centerY=0.5, scale=1.0),
        )
        assert data.bodyweight_kg == 80.0
        assert data.pose_type == "back"

    def test_invalid_pose_type_rejected(self):
        with pytest.raises(PydanticValidationError):
            PhotoCreate(capture_date=date.today(), pose_type="invalid_pose")

    def test_bodyweight_below_minimum_rejected(self):
        with pytest.raises(PydanticValidationError):
            PhotoCreate(capture_date=date.today(), bodyweight_kg=MIN_BODYWEIGHT_KG - 1)

    def test_bodyweight_above_maximum_rejected(self):
        with pytest.raises(PydanticValidationError):
            PhotoCreate(capture_date=date.today(), bodyweight_kg=MAX_BODYWEIGHT_KG + 1)

    def test_bodyweight_at_boundaries_accepted(self):
        low = PhotoCreate(capture_date=date.today(), bodyweight_kg=MIN_BODYWEIGHT_KG)
        assert low.bodyweight_kg == MIN_BODYWEIGHT_KG
        high = PhotoCreate(capture_date=date.today(), bodyweight_kg=MAX_BODYWEIGHT_KG)
        assert high.bodyweight_kg == MAX_BODYWEIGHT_KG

    def test_notes_too_long_rejected(self):
        with pytest.raises(PydanticValidationError):
            PhotoCreate(capture_date=date.today(), notes="x" * (MAX_NOTES_LENGTH + 1))

    def test_notes_at_max_length_accepted(self):
        data = PhotoCreate(capture_date=date.today(), notes="x" * MAX_NOTES_LENGTH)
        assert len(data.notes) == MAX_NOTES_LENGTH

    def test_capture_date_far_future_rejected(self):
        far_future = date.today() + timedelta(days=MAX_FUTURE_DAYS + 10)
        with pytest.raises(PydanticValidationError):
            PhotoCreate(capture_date=far_future)

    def test_capture_date_today_accepted(self):
        data = PhotoCreate(capture_date=date.today())
        assert data.capture_date == date.today()

    def test_capture_date_past_accepted(self):
        past = date(2023, 1, 1)
        data = PhotoCreate(capture_date=past)
        assert data.capture_date == past

    def test_all_valid_pose_types(self):
        for pose in ["front_relaxed", "front_double_bicep", "side", "back"]:
            data = PhotoCreate(capture_date=date.today(), pose_type=pose)
            assert data.pose_type == pose


class TestAlignmentDataValidation:
    """Validate AlignmentData schema constraints."""

    def test_valid_alignment(self):
        a = AlignmentData(centerX=0.5, centerY=0.5, scale=1.0)
        assert a.centerX == 0.5

    def test_center_out_of_range(self):
        with pytest.raises(PydanticValidationError):
            AlignmentData(centerX=1.5, centerY=0.5, scale=1.0)
        with pytest.raises(PydanticValidationError):
            AlignmentData(centerX=0.5, centerY=-0.1, scale=1.0)

    def test_scale_zero_rejected(self):
        with pytest.raises(PydanticValidationError):
            AlignmentData(centerX=0.5, centerY=0.5, scale=0.0)

    def test_scale_too_large_rejected(self):
        with pytest.raises(PydanticValidationError):
            AlignmentData(centerX=0.5, centerY=0.5, scale=11.0)

    def test_boundary_values(self):
        a = AlignmentData(centerX=0.0, centerY=1.0, scale=0.01)
        assert a.centerX == 0.0
        assert a.centerY == 1.0


class TestPhotoUpdateValidation:
    """Validate PhotoUpdate schema constraints."""

    def test_empty_update_valid(self):
        data = PhotoUpdate()
        assert data.alignment_data is None
        assert data.notes is None
        assert data.bodyweight_kg is None

    def test_update_notes_too_long(self):
        with pytest.raises(PydanticValidationError):
            PhotoUpdate(notes="x" * (MAX_NOTES_LENGTH + 1))

    def test_update_bodyweight_out_of_range(self):
        with pytest.raises(PydanticValidationError):
            PhotoUpdate(bodyweight_kg=5.0)

    def test_update_with_valid_fields(self):
        data = PhotoUpdate(
            notes="Updated note",
            bodyweight_kg=75.0,
            alignment_data=AlignmentData(centerX=0.3, centerY=0.7, scale=1.2),
        )
        assert data.notes == "Updated note"
        assert data.bodyweight_kg == 75.0


class TestPhotoResponseSchema:
    """Validate PhotoResponse schema."""

    def test_from_attributes(self):
        now = datetime.now(timezone.utc)
        resp = PhotoResponse(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            capture_date=date.today(),
            bodyweight_kg=80.0,
            pose_type="front_relaxed",
            notes=None,
            alignment_data=None,
            created_at=now,
            updated_at=now,
        )
        assert resp.pose_type == "front_relaxed"


# ===========================================================================
# Service-level tests (require db_session fixture)
# ===========================================================================


class TestProgressPhotoServiceCreate:
    """Test photo creation logic."""

    @pytest.mark.asyncio
    async def test_create_photo_basic(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        service = ProgressPhotoService(db_session)
        data = PhotoCreate(capture_date=date.today(), pose_type="front_relaxed")
        photo = await service.create_photo(user_id=user.id, data=data)

        assert photo.user_id == user.id
        assert photo.capture_date == date.today()
        assert photo.pose_type == "front_relaxed"
        assert photo.bodyweight_kg is None

    @pytest.mark.asyncio
    async def test_create_photo_auto_fills_bodyweight(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        await _create_bodyweight(db_session, user.id, 82.5, date.today())
        service = ProgressPhotoService(db_session)
        data = PhotoCreate(capture_date=date.today())
        photo = await service.create_photo(user_id=user.id, data=data)

        assert photo.bodyweight_kg is not None
        assert abs(photo.bodyweight_kg - 82.5) < 0.01

    @pytest.mark.asyncio
    async def test_create_photo_explicit_bodyweight_preserved(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        await _create_bodyweight(db_session, user.id, 82.5, date.today())
        service = ProgressPhotoService(db_session)
        data = PhotoCreate(capture_date=date.today(), bodyweight_kg=90.0)
        photo = await service.create_photo(user_id=user.id, data=data)

        assert abs(photo.bodyweight_kg - 90.0) < 0.01

    @pytest.mark.asyncio
    async def test_create_photo_with_notes(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        service = ProgressPhotoService(db_session)
        data = PhotoCreate(capture_date=date.today(), notes="Morning, fasted")
        photo = await service.create_photo(user_id=user.id, data=data)

        assert photo.notes == "Morning, fasted"

    @pytest.mark.asyncio
    async def test_create_photo_with_alignment(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        service = ProgressPhotoService(db_session)
        alignment = AlignmentData(centerX=0.5, centerY=0.5, scale=1.0)
        data = PhotoCreate(capture_date=date.today(), alignment_data=alignment)
        photo = await service.create_photo(user_id=user.id, data=data)

        assert photo.alignment_data is not None
        assert photo.alignment_data["centerX"] == 0.5


class TestProgressPhotoServiceGet:
    """Test single photo retrieval."""

    @pytest.mark.asyncio
    async def test_get_existing_photo(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        service = ProgressPhotoService(db_session)
        data = PhotoCreate(capture_date=date.today())
        created = await service.create_photo(user_id=user.id, data=data)

        fetched = await service.get_photo(user_id=user.id, photo_id=created.id)
        assert fetched.id == created.id

    @pytest.mark.asyncio
    async def test_get_nonexistent_photo_raises(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        service = ProgressPhotoService(db_session)

        with pytest.raises(NotFoundError):
            await service.get_photo(user_id=user.id, photo_id=uuid.uuid4())

    @pytest.mark.asyncio
    async def test_get_other_users_photo_raises(self, db_session: AsyncSession):
        user1 = await _create_user(db_session)
        user2 = await _create_user(db_session)
        service = ProgressPhotoService(db_session)

        data = PhotoCreate(capture_date=date.today())
        photo = await service.create_photo(user_id=user1.id, data=data)

        with pytest.raises(NotFoundError):
            await service.get_photo(user_id=user2.id, photo_id=photo.id)


class TestProgressPhotoServiceList:
    """Test photo listing with pagination and filters."""

    @pytest.mark.asyncio
    async def test_list_empty(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        service = ProgressPhotoService(db_session)
        pagination = PaginationParams(page=1, limit=20)
        result = await service.list_photos(user_id=user.id, pagination=pagination)

        assert result.total_count == 0
        assert len(result.items) == 0

    @pytest.mark.asyncio
    async def test_list_single_photo(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        service = ProgressPhotoService(db_session)
        await service.create_photo(
            user_id=user.id,
            data=PhotoCreate(capture_date=date.today()),
        )
        pagination = PaginationParams(page=1, limit=20)
        result = await service.list_photos(user_id=user.id, pagination=pagination)

        assert result.total_count == 1
        assert len(result.items) == 1

    @pytest.mark.asyncio
    async def test_list_chronological_order(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        service = ProgressPhotoService(db_session)

        dates = [date(2024, 3, 1), date(2024, 1, 1), date(2024, 2, 1)]
        for d in dates:
            await service.create_photo(
                user_id=user.id,
                data=PhotoCreate(capture_date=d),
            )

        pagination = PaginationParams(page=1, limit=20)
        result = await service.list_photos(user_id=user.id, pagination=pagination)

        assert len(result.items) == 3
        assert result.items[0].capture_date == date(2024, 1, 1)
        assert result.items[1].capture_date == date(2024, 2, 1)
        assert result.items[2].capture_date == date(2024, 3, 1)

    @pytest.mark.asyncio
    async def test_list_pose_type_filter(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        service = ProgressPhotoService(db_session)

        await service.create_photo(
            user_id=user.id,
            data=PhotoCreate(capture_date=date(2024, 1, 1), pose_type="front_relaxed"),
        )
        await service.create_photo(
            user_id=user.id,
            data=PhotoCreate(capture_date=date(2024, 1, 2), pose_type="back"),
        )
        await service.create_photo(
            user_id=user.id,
            data=PhotoCreate(capture_date=date(2024, 1, 3), pose_type="front_relaxed"),
        )

        pagination = PaginationParams(page=1, limit=20)
        result = await service.list_photos(
            user_id=user.id, pagination=pagination, pose_type="front_relaxed",
        )

        assert result.total_count == 2
        for item in result.items:
            assert item.pose_type == "front_relaxed"

    @pytest.mark.asyncio
    async def test_list_pagination(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        service = ProgressPhotoService(db_session)

        for i in range(5):
            await service.create_photo(
                user_id=user.id,
                data=PhotoCreate(capture_date=date(2024, 1, i + 1)),
            )

        page1 = await service.list_photos(
            user_id=user.id, pagination=PaginationParams(page=1, limit=2),
        )
        assert len(page1.items) == 2
        assert page1.total_count == 5

        page3 = await service.list_photos(
            user_id=user.id, pagination=PaginationParams(page=3, limit=2),
        )
        assert len(page3.items) == 1

    @pytest.mark.asyncio
    async def test_list_excludes_other_users(self, db_session: AsyncSession):
        user1 = await _create_user(db_session)
        user2 = await _create_user(db_session)
        service = ProgressPhotoService(db_session)

        await service.create_photo(
            user_id=user1.id,
            data=PhotoCreate(capture_date=date.today()),
        )
        await service.create_photo(
            user_id=user2.id,
            data=PhotoCreate(capture_date=date.today()),
        )

        pagination = PaginationParams(page=1, limit=20)
        result = await service.list_photos(user_id=user1.id, pagination=pagination)
        assert result.total_count == 1


class TestProgressPhotoServiceUpdate:
    """Test photo update logic."""

    @pytest.mark.asyncio
    async def test_update_alignment_data(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        service = ProgressPhotoService(db_session)
        photo = await service.create_photo(
            user_id=user.id,
            data=PhotoCreate(capture_date=date.today()),
        )

        alignment = AlignmentData(centerX=0.3, centerY=0.7, scale=1.5)
        updated = await service.update_photo(
            user_id=user.id,
            photo_id=photo.id,
            data=PhotoUpdate(alignment_data=alignment),
        )
        assert updated.alignment_data["centerX"] == 0.3
        assert updated.alignment_data["scale"] == 1.5

    @pytest.mark.asyncio
    async def test_update_notes(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        service = ProgressPhotoService(db_session)
        photo = await service.create_photo(
            user_id=user.id,
            data=PhotoCreate(capture_date=date.today(), notes="old"),
        )

        updated = await service.update_photo(
            user_id=user.id,
            photo_id=photo.id,
            data=PhotoUpdate(notes="new note"),
        )
        assert updated.notes == "new note"

    @pytest.mark.asyncio
    async def test_update_bodyweight(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        service = ProgressPhotoService(db_session)
        photo = await service.create_photo(
            user_id=user.id,
            data=PhotoCreate(capture_date=date.today()),
        )

        updated = await service.update_photo(
            user_id=user.id,
            photo_id=photo.id,
            data=PhotoUpdate(bodyweight_kg=77.5),
        )
        assert abs(updated.bodyweight_kg - 77.5) < 0.01

    @pytest.mark.asyncio
    async def test_update_nonexistent_raises(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        service = ProgressPhotoService(db_session)

        with pytest.raises(NotFoundError):
            await service.update_photo(
                user_id=user.id,
                photo_id=uuid.uuid4(),
                data=PhotoUpdate(notes="nope"),
            )


class TestProgressPhotoServiceDelete:
    """Test soft-delete logic."""

    @pytest.mark.asyncio
    async def test_delete_photo(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        service = ProgressPhotoService(db_session)
        photo = await service.create_photo(
            user_id=user.id,
            data=PhotoCreate(capture_date=date.today()),
        )

        await service.delete_photo(user_id=user.id, photo_id=photo.id)

        # Should not be found after deletion
        with pytest.raises(NotFoundError):
            await service.get_photo(user_id=user.id, photo_id=photo.id)

    @pytest.mark.asyncio
    async def test_delete_excludes_from_list(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        service = ProgressPhotoService(db_session)

        photo1 = await service.create_photo(
            user_id=user.id,
            data=PhotoCreate(capture_date=date(2024, 1, 1)),
        )
        await service.create_photo(
            user_id=user.id,
            data=PhotoCreate(capture_date=date(2024, 1, 2)),
        )

        await service.delete_photo(user_id=user.id, photo_id=photo1.id)

        pagination = PaginationParams(page=1, limit=20)
        result = await service.list_photos(user_id=user.id, pagination=pagination)
        assert result.total_count == 1
        assert result.items[0].capture_date == date(2024, 1, 2)

    @pytest.mark.asyncio
    async def test_delete_nonexistent_raises(self, db_session: AsyncSession):
        user = await _create_user(db_session)
        service = ProgressPhotoService(db_session)

        with pytest.raises(NotFoundError):
            await service.delete_photo(user_id=user.id, photo_id=uuid.uuid4())

    @pytest.mark.asyncio
    async def test_delete_other_users_photo_raises(self, db_session: AsyncSession):
        user1 = await _create_user(db_session)
        user2 = await _create_user(db_session)
        service = ProgressPhotoService(db_session)

        photo = await service.create_photo(
            user_id=user1.id,
            data=PhotoCreate(capture_date=date.today()),
        )

        with pytest.raises(NotFoundError):
            await service.delete_photo(user_id=user2.id, photo_id=photo.id)
