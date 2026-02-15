"""Property-based tests for progress photo metadata.

Tests Properties 25 and 26 from the design document using Hypothesis.
Operates at the service level using the db_session fixture.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.progress_photos.models import ProgressPhoto
from src.modules.progress_photos.schemas import PhotoCreate
from src.modules.progress_photos.service import ProgressPhotoService
from src.modules.user.models import BodyweightLog
from src.modules.auth.models import User
from src.shared.pagination import PaginationParams


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

VALID_POSE_TYPES = ["front_relaxed", "front_double_bicep", "side", "back"]

_pose_types = st.sampled_from(VALID_POSE_TYPES)

_positive_weights = st.floats(
    min_value=30.0, max_value=300.0, allow_nan=False, allow_infinity=False,
)

_dates = st.dates(
    min_value=date(2020, 1, 1),
    max_value=date.today(),
)

_optional_notes = st.one_of(st.none(), st.text(min_size=1, max_size=200))

_optional_weights = st.one_of(st.none(), _positive_weights)


# ---------------------------------------------------------------------------
# Shared Hypothesis settings
# ---------------------------------------------------------------------------

_fixture_settings = h_settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_test_user(db: AsyncSession) -> User:
    """Create a minimal test user and return it."""
    user = User(
        id=uuid.uuid4(),
        email=f"test-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="fakehash",
    )
    db.add(user)
    await db.flush()
    return user


async def _create_bodyweight_log(
    db: AsyncSession, user_id: uuid.UUID, weight_kg: float, recorded_date: date,
) -> BodyweightLog:
    """Create a bodyweight log entry."""
    log = BodyweightLog(
        user_id=user_id,
        weight_kg=weight_kg,
        recorded_date=recorded_date,
    )
    db.add(log)
    await db.flush()
    return log


# ---------------------------------------------------------------------------
# Property 25: Progress photo metadata tagging
# ---------------------------------------------------------------------------


class TestProperty25ProgressPhotoMetadataTagging:
    """Property 25: Progress photo metadata tagging.

    For any progress photo created when the user has at least one bodyweight
    log, the photo's bodyweight_kg field should equal the most recent
    BodyweightLog.weight_kg for that user (not null). When no bodyweight log
    exists, bodyweight_kg should be null.

    **Validates: Requirements 5.1.3**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        pose_type=_pose_types,
        capture_date=_dates,
        notes=_optional_notes,
    )
    async def test_capture_date_matches_input(
        self,
        pose_type: str,
        capture_date: date,
        notes: str | None,
        db_session: AsyncSession,
    ):
        """Created photo has capture_date matching input and pose_type in valid set.

        **Validates: Requirements 5.1.3**
        """
        user = await _create_test_user(db_session)
        service = ProgressPhotoService(db_session)

        data = PhotoCreate(
            capture_date=capture_date,
            pose_type=pose_type,
            notes=notes,
        )
        photo = await service.create_photo(user_id=user.id, data=data)

        assert photo.capture_date == capture_date, (
            f"Expected capture_date={capture_date}, got {photo.capture_date}"
        )
        assert photo.pose_type == pose_type, (
            f"Expected pose_type='{pose_type}', got '{photo.pose_type}'"
        )
        assert photo.pose_type in VALID_POSE_TYPES

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        weight_kg=_positive_weights,
        capture_date=_dates,
    )
    async def test_bodyweight_auto_filled_from_latest_log(
        self,
        weight_kg: float,
        capture_date: date,
        db_session: AsyncSession,
    ):
        """When bodyweight_kg is not provided, it's auto-filled from latest BodyweightLog.

        **Validates: Requirements 5.1.3**
        """
        user = await _create_test_user(db_session)

        # Create a bodyweight log entry
        await _create_bodyweight_log(
            db_session, user.id, weight_kg, capture_date,
        )

        service = ProgressPhotoService(db_session)
        data = PhotoCreate(
            capture_date=capture_date,
            bodyweight_kg=None,  # Not provided — should auto-fill
        )
        photo = await service.create_photo(user_id=user.id, data=data)

        assert photo.bodyweight_kg is not None, (
            "bodyweight_kg should be auto-filled when user has bodyweight logs"
        )
        assert abs(photo.bodyweight_kg - weight_kg) < 0.01, (
            f"Expected bodyweight_kg≈{weight_kg}, got {photo.bodyweight_kg}"
        )

    @pytest.mark.asyncio
    @_fixture_settings
    @given(capture_date=_dates)
    async def test_bodyweight_null_when_no_logs(
        self,
        capture_date: date,
        db_session: AsyncSession,
    ):
        """When no bodyweight log exists, bodyweight_kg should be null.

        **Validates: Requirements 5.1.3**
        """
        user = await _create_test_user(db_session)
        service = ProgressPhotoService(db_session)

        data = PhotoCreate(
            capture_date=capture_date,
            bodyweight_kg=None,
        )
        photo = await service.create_photo(user_id=user.id, data=data)

        assert photo.bodyweight_kg is None, (
            f"Expected bodyweight_kg=None when no logs exist, got {photo.bodyweight_kg}"
        )

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        explicit_weight=_positive_weights,
        capture_date=_dates,
    )
    async def test_explicit_bodyweight_preserved(
        self,
        explicit_weight: float,
        capture_date: date,
        db_session: AsyncSession,
    ):
        """When bodyweight_kg is explicitly provided, it's used as-is.

        **Validates: Requirements 5.1.3**
        """
        user = await _create_test_user(db_session)
        service = ProgressPhotoService(db_session)

        data = PhotoCreate(
            capture_date=capture_date,
            bodyweight_kg=explicit_weight,
        )
        photo = await service.create_photo(user_id=user.id, data=data)

        assert abs(photo.bodyweight_kg - explicit_weight) < 0.01, (
            f"Expected bodyweight_kg≈{explicit_weight}, got {photo.bodyweight_kg}"
        )


# ---------------------------------------------------------------------------
# Property 26: Progress photo chronological ordering
# ---------------------------------------------------------------------------


class TestProperty26ProgressPhotoChronologicalOrdering:
    """Property 26: Progress photo chronological ordering.

    For any set of progress photos belonging to a user, the list endpoint
    should return them sorted by capture_date in ascending order. For photos
    with the same capture_date, order by created_at ascending.

    **Validates: Requirements 5.2.3**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=st.data())
    async def test_photos_returned_in_chronological_order(
        self,
        data,
        db_session: AsyncSession,
    ):
        """Listing photos returns them sorted by capture_date ASC.

        **Validates: Requirements 5.2.3**
        """
        user = await _create_test_user(db_session)
        service = ProgressPhotoService(db_session)

        # Create between 3 and 10 photos with random dates
        num_photos = data.draw(st.integers(min_value=3, max_value=10))
        for _ in range(num_photos):
            capture_date = data.draw(_dates)
            pose_type = data.draw(_pose_types)
            photo_data = PhotoCreate(
                capture_date=capture_date,
                pose_type=pose_type,
            )
            await service.create_photo(user_id=user.id, data=photo_data)

        # List all photos
        pagination = PaginationParams(page=1, limit=100)
        result = await service.list_photos(user_id=user.id, pagination=pagination)

        assert len(result.items) == num_photos, (
            f"Expected {num_photos} photos, got {len(result.items)}"
        )

        # Verify chronological ordering
        for i in range(len(result.items) - 1):
            curr = result.items[i]
            nxt = result.items[i + 1]
            assert curr.capture_date <= nxt.capture_date, (
                f"Chronological order violated: {curr.capture_date} > {nxt.capture_date}"
            )

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=st.data())
    async def test_pose_type_filter_preserves_order(
        self,
        data,
        db_session: AsyncSession,
    ):
        """Filtering by pose_type still returns chronologically ordered results.

        **Validates: Requirements 5.2.3**
        """
        user = await _create_test_user(db_session)
        service = ProgressPhotoService(db_session)

        target_pose = data.draw(_pose_types)

        # Create photos with mixed pose types
        for _ in range(6):
            capture_date = data.draw(_dates)
            pose_type = data.draw(_pose_types)
            photo_data = PhotoCreate(
                capture_date=capture_date,
                pose_type=pose_type,
            )
            await service.create_photo(user_id=user.id, data=photo_data)

        # Also create at least 2 with the target pose type
        for _ in range(2):
            capture_date = data.draw(_dates)
            photo_data = PhotoCreate(
                capture_date=capture_date,
                pose_type=target_pose,
            )
            await service.create_photo(user_id=user.id, data=photo_data)

        # List with filter
        pagination = PaginationParams(page=1, limit=100)
        result = await service.list_photos(
            user_id=user.id, pagination=pagination, pose_type=target_pose,
        )

        # All returned items should have the target pose type
        for item in result.items:
            assert item.pose_type == target_pose

        # Verify chronological ordering
        for i in range(len(result.items) - 1):
            curr = result.items[i]
            nxt = result.items[i + 1]
            assert curr.capture_date <= nxt.capture_date, (
                f"Chronological order violated with filter: "
                f"{curr.capture_date} > {nxt.capture_date}"
            )
