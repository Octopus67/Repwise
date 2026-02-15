"""Tests for training log redesign schema extensions and service.

Validates the extended SetEntry (set_type), TrainingSessionCreate
(start_time, end_time, future-date rejection), TrainingSessionResponse
(from_orm_model with new fields), backward compatibility, and a
Hypothesis property test for SetEntry round-trip serialization.

**Validates: Requirements 6.5, 10.4, 1.8**
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st
from pydantic import ValidationError

from src.modules.training.schemas import (
    ExerciseEntry,
    SetEntry,
    TrainingSessionCreate,
    TrainingSessionResponse,
)
from src.modules.training.service import TrainingService


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_valid_set_types = st.sampled_from(["normal", "warm-up", "drop-set", "amrap"])

_valid_set_entry = st.builds(
    SetEntry,
    reps=st.integers(min_value=0, max_value=100),
    weight_kg=st.floats(min_value=0.0, max_value=500.0, allow_nan=False, allow_infinity=False),
    rpe=st.one_of(
        st.none(),
        st.floats(min_value=0.0, max_value=10.0, allow_nan=False, allow_infinity=False),
    ),
    set_type=_valid_set_types,
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
# SetEntry validation tests
# ---------------------------------------------------------------------------


class TestSetEntryValidation:
    """Tests for the extended SetEntry schema with set_type field.

    **Validates: Requirements 6.5**
    """

    def test_set_type_normal_passes(self):
        """SetEntry with set_type='normal' passes validation."""
        entry = SetEntry(reps=8, weight_kg=80.0, set_type="normal")
        assert entry.set_type == "normal"

    def test_set_type_invalid_raises(self):
        """SetEntry with set_type='invalid' raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            SetEntry(reps=8, weight_kg=80.0, set_type="invalid")
        assert "set_type" in str(exc_info.value)

    def test_set_type_defaults_to_normal(self):
        """SetEntry without set_type defaults to 'normal'."""
        entry = SetEntry(reps=5, weight_kg=60.0)
        assert entry.set_type == "normal"


# ---------------------------------------------------------------------------
# TrainingSessionCreate validation tests
# ---------------------------------------------------------------------------


class TestTrainingSessionCreateValidation:
    """Tests for the extended TrainingSessionCreate schema.

    **Validates: Requirements 10.4, 1.8**
    """

    def test_future_session_date_raises(self):
        """TrainingSessionCreate with future session_date raises ValidationError."""
        future_date = date.today() + timedelta(days=1)
        with pytest.raises(ValidationError) as exc_info:
            TrainingSessionCreate(
                session_date=future_date,
                exercises=[
                    ExerciseEntry(
                        exercise_name="Squat",
                        sets=[SetEntry(reps=5, weight_kg=100.0)],
                    )
                ],
            )
        assert "session_date" in str(exc_info.value)

    def test_today_date_passes(self):
        """TrainingSessionCreate with today's date passes validation."""
        session = TrainingSessionCreate(
            session_date=date.today(),
            exercises=[
                ExerciseEntry(
                    exercise_name="Squat",
                    sets=[SetEntry(reps=5, weight_kg=100.0)],
                )
            ],
        )
        assert session.session_date == date.today()

    def test_start_time_end_time_serializes(self):
        """TrainingSessionCreate with start_time/end_time serializes correctly."""
        start = datetime(2024, 6, 15, 14, 30, 0, tzinfo=timezone.utc)
        end = datetime(2024, 6, 15, 15, 45, 0, tzinfo=timezone.utc)
        session = TrainingSessionCreate(
            session_date=date(2024, 6, 15),
            exercises=[
                ExerciseEntry(
                    exercise_name="Bench Press",
                    sets=[SetEntry(reps=8, weight_kg=80.0)],
                )
            ],
            start_time=start,
            end_time=end,
        )
        dumped = session.model_dump()
        assert dumped["start_time"] == start
        assert dumped["end_time"] == end


# ---------------------------------------------------------------------------
# TrainingSessionResponse.from_orm_model tests
# ---------------------------------------------------------------------------


class TestTrainingSessionResponseFromOrm:
    """Tests for TrainingSessionResponse.from_orm_model with new fields.

    **Validates: Requirements 1.8**
    """

    def test_from_orm_model_includes_start_end_time(self):
        """from_orm_model includes start_time and end_time from the ORM object."""
        now = datetime.now(timezone.utc)
        start = now - timedelta(hours=1)
        end = now
        orm_obj = SimpleNamespace(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            session_date=date.today(),
            exercises=[
                {
                    "exercise_name": "Deadlift",
                    "sets": [{"reps": 5, "weight_kg": 140.0}],
                }
            ],
            metadata_=None,
            start_time=start,
            end_time=end,
            created_at=now,
            updated_at=now,
        )
        response = TrainingSessionResponse.from_orm_model(orm_obj)
        assert response.start_time == start
        assert response.end_time == end


# ---------------------------------------------------------------------------
# Backward compatibility test
# ---------------------------------------------------------------------------


class TestBackwardCompatibility:
    """Existing session creation still works without new fields.

    **Validates: Requirements 6.5, 10.4, 1.8**
    """

    @pytest.mark.asyncio
    async def test_create_session_without_new_fields(self, db_session):
        """Creating a session without set_type or start_time still works."""
        user_id = uuid.uuid4()
        service = TrainingService(db_session)

        data = TrainingSessionCreate(
            session_date=date.today(),
            exercises=[
                ExerciseEntry(
                    exercise_name="Overhead Press",
                    sets=[SetEntry(reps=8, weight_kg=40.0)],
                )
            ],
        )
        created = await service.create_session(user_id=user_id, data=data)

        assert created.user_id == user_id
        assert created.session_date == date.today()
        assert len(created.exercises) == 1
        assert created.exercises[0].sets[0].set_type == "normal"
        assert created.start_time is None
        assert created.end_time is None


# ---------------------------------------------------------------------------
# Property test: SetEntry dict round-trip
# ---------------------------------------------------------------------------


class TestSetEntryRoundTrip:
    """Property test: serializing a valid SetEntry to dict and back
    produces an identical object.

    **Validates: Requirements 6.5**
    """

    @h_settings(max_examples=50, deadline=None)
    @given(entry=_valid_set_entry)
    def test_set_entry_dict_round_trip(self, entry: SetEntry):
        """For any valid SetEntry, model_dump → SetEntry(**dict) is identical.

        **Validates: Requirements 6.5**
        """
        dumped = entry.model_dump()
        restored = SetEntry(**dumped)
        assert restored.reps == entry.reps
        assert restored.weight_kg == pytest.approx(entry.weight_kg, abs=1e-6)
        assert restored.set_type == entry.set_type
        if entry.rpe is not None:
            assert restored.rpe == pytest.approx(entry.rpe, abs=1e-6)
        else:
            assert restored.rpe is None
