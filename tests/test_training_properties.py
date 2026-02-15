"""Property-based tests for the training module.

Tests Properties 1 and 2 from the design document using Hypothesis,
exercised at the service level via db_session fixture.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st

from src.modules.training.schemas import (
    ExerciseEntry,
    SetEntry,
    TrainingSessionCreate,
)
from src.modules.training.service import TrainingService
from src.shared.pagination import PaginationParams


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_set_entry = st.builds(
    SetEntry,
    reps=st.integers(min_value=1, max_value=100),
    weight_kg=st.floats(min_value=0.0, max_value=500.0, allow_nan=False, allow_infinity=False),
    rpe=st.one_of(st.none(), st.floats(min_value=0.0, max_value=10.0, allow_nan=False, allow_infinity=False)),
)

_exercise_entry = st.builds(
    ExerciseEntry,
    exercise_name=st.text(
        alphabet=st.characters(whitelist_categories=("L", "N", "Zs"), max_codepoint=127),
        min_size=1,
        max_size=50,
    ).filter(lambda s: s.strip()),
    sets=st.lists(_set_entry, min_size=1, max_size=5),
)

_session_date = st.dates(
    min_value=date(2020, 1, 1),
    max_value=date.today(),
)

_training_session_create = st.builds(
    TrainingSessionCreate,
    session_date=_session_date,
    exercises=st.lists(_exercise_entry, min_size=1, max_size=5),
    metadata=st.one_of(st.none(), st.fixed_dictionaries({"notes": st.text(max_size=100)})),
)


# ---------------------------------------------------------------------------
# Shared Hypothesis settings
# ---------------------------------------------------------------------------

_fixture_settings = h_settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)


# ---------------------------------------------------------------------------
# Property 1: Entity creation round-trip
# ---------------------------------------------------------------------------


class TestProperty1EntityCreationRoundTrip:
    """Property 1: Entity creation round-trip.

    For any valid training session input, creating the entity and then
    retrieving it SHALL produce an object with equivalent field values.

    **Validates: Requirements 6.1**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(data=_training_session_create)
    async def test_create_and_retrieve_round_trip(
        self, data: TrainingSessionCreate, db_session
    ):
        """Create a random training session and verify retrieval returns equivalent data.

        **Validates: Requirements 6.1**
        """
        user_id = uuid.uuid4()
        service = TrainingService(db_session)

        created = await service.create_session(user_id=user_id, data=data)

        # Verify the created response matches input
        assert created.user_id == user_id
        assert created.session_date == data.session_date
        assert len(created.exercises) == len(data.exercises)

        for orig, returned in zip(data.exercises, created.exercises):
            assert returned.exercise_name == orig.exercise_name
            assert len(returned.sets) == len(orig.sets)
            for orig_set, ret_set in zip(orig.sets, returned.sets):
                assert ret_set.reps == orig_set.reps
                assert ret_set.weight_kg == pytest.approx(orig_set.weight_kg, abs=1e-6)
                if orig_set.rpe is not None:
                    assert ret_set.rpe == pytest.approx(orig_set.rpe, abs=1e-6)
                else:
                    assert ret_set.rpe is None

        assert created.metadata == data.metadata

        # Retrieve via get_sessions and verify the session is present
        pagination = PaginationParams(page=1, limit=100)
        result = await service.get_sessions(user_id=user_id, pagination=pagination)
        assert result.total_count >= 1

        found = [s for s in result.items if s.id == created.id]
        assert len(found) == 1
        retrieved = found[0]

        assert retrieved.session_date == data.session_date
        assert len(retrieved.exercises) == len(data.exercises)
        assert retrieved.metadata == data.metadata


# ---------------------------------------------------------------------------
# Property 2: Date range filtering correctness
# ---------------------------------------------------------------------------


class TestProperty2DateRangeFiltering:
    """Property 2: Date range filtering correctness.

    For any date range query on training sessions, all returned records
    SHALL have their session_date within the specified range, and no
    records outside the range SHALL be returned.

    **Validates: Requirements 6.2**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        dates=st.lists(
            st.dates(min_value=date(2023, 1, 1), max_value=date(2024, 12, 31)),
            min_size=3,
            max_size=10,
        ),
        range_start_offset=st.integers(min_value=0, max_value=365),
        range_length=st.integers(min_value=1, max_value=180),
    )
    async def test_date_range_returns_only_matching_sessions(
        self,
        dates: list[date],
        range_start_offset: int,
        range_length: int,
        db_session,
    ):
        """Create sessions across random dates, query a random range,
        verify all results are within range and none outside are included.

        **Validates: Requirements 6.2**
        """
        user_id = uuid.uuid4()
        service = TrainingService(db_session)

        # Create sessions on each date
        for d in dates:
            session_data = TrainingSessionCreate(
                session_date=d,
                exercises=[
                    ExerciseEntry(
                        exercise_name="Squat",
                        sets=[SetEntry(reps=5, weight_kg=100.0)],
                    )
                ],
            )
            await service.create_session(user_id=user_id, data=session_data)

        # Define a random query range
        base_date = date(2023, 1, 1)
        start_date = base_date + timedelta(days=range_start_offset)
        end_date = start_date + timedelta(days=range_length)

        # Clamp to valid date range
        if end_date > date(2024, 12, 31):
            end_date = date(2024, 12, 31)
        if start_date > end_date:
            start_date = end_date

        pagination = PaginationParams(page=1, limit=100)
        result = await service.get_sessions(
            user_id=user_id,
            pagination=pagination,
            start_date=start_date,
            end_date=end_date,
        )

        # All returned sessions must be within the range
        for session in result.items:
            assert start_date <= session.session_date <= end_date, (
                f"Session date {session.session_date} outside range "
                f"[{start_date}, {end_date}]"
            )

        # Count how many input dates fall within the range
        expected_count = sum(1 for d in dates if start_date <= d <= end_date)
        assert result.total_count == expected_count, (
            f"Expected {expected_count} sessions in range "
            f"[{start_date}, {end_date}], got {result.total_count}"
        )
