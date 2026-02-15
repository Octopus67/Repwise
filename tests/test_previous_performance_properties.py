"""Property-based tests for the Previous Performance Resolver.

Tests Property 13 from the Product Polish V2 design document using
Hypothesis, exercised at the service level via the db_session fixture.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st

from src.modules.training.analytics_schemas import PreviousPerformance
from src.modules.training.models import TrainingSession
from src.modules.training.previous_performance import PreviousPerformanceResolver
from src.modules.training.schemas import ExerciseEntry, SetEntry


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_set_entry_st = st.builds(
    SetEntry,
    reps=st.integers(min_value=1, max_value=50),
    weight_kg=st.floats(min_value=0.5, max_value=300.0, allow_nan=False, allow_infinity=False),
    rpe=st.none(),
)

_exercise_name_st = st.sampled_from([
    "bench press", "squat", "deadlift", "overhead press",
    "barbell row", "bicep curl", "tricep extension", "leg press",
])

_exercise_entry_st = st.builds(
    ExerciseEntry,
    exercise_name=_exercise_name_st,
    sets=st.lists(_set_entry_st, min_size=1, max_size=5),
)

# Generate a list of sessions: each is (date_offset_days, exercises).
# We use offsets from a base date to ensure distinct dates.
_session_date_offset_st = st.integers(min_value=0, max_value=180)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_BASE_DATE = date(2024, 1, 1)


async def _seed_sessions(
    db_session,
    user_id: uuid.UUID,
    sessions: list[tuple[int, list[ExerciseEntry]]],
) -> list[tuple[date, list[ExerciseEntry]]]:
    """Insert training sessions and return (date, exercises) pairs."""
    result = []
    for offset, exercises in sessions:
        session_date = _BASE_DATE + timedelta(days=offset)
        ts = TrainingSession(
            user_id=user_id,
            session_date=session_date,
            exercises=[ex.model_dump() for ex in exercises],
        )
        db_session.add(ts)
        result.append((session_date, exercises))
    await db_session.flush()
    return result


# ---------------------------------------------------------------------------
# Shared Hypothesis settings — 100 examples minimum
# ---------------------------------------------------------------------------

_pbt_settings = h_settings(
    max_examples=100,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)


# ---------------------------------------------------------------------------
# Property 13: Previous performance recency
# ---------------------------------------------------------------------------


class TestProperty13PreviousPerformanceRecency:
    """Property 13: Previous performance recency.

    For any user with N sessions containing exercise X (N≥2), the resolver
    returns data from the session with the latest session_date, and the
    weight/reps match the last set of that exercise in that session.

    **Validates: Requirements 6.1**
    """

    @pytest.mark.asyncio
    @_pbt_settings
    @given(
        target_exercise=_exercise_name_st,
        date_offsets=st.lists(
            st.integers(min_value=0, max_value=180),
            min_size=2,
            max_size=6,
            unique=True,
        ),
        extra_sets_per_session=st.lists(
            st.lists(_set_entry_st, min_size=1, max_size=4),
            min_size=2,
            max_size=6,
        ),
    )
    async def test_returns_most_recent_session_last_set(
        self,
        target_exercise: str,
        date_offsets: list[int],
        extra_sets_per_session: list[list[SetEntry]],
        db_session,
    ):
        """Resolver returns data from the most recent session, last set of the exercise.

        **Validates: Requirements 6.1**
        """
        user_id = uuid.uuid4()

        # Ensure we have enough sets lists for each date offset
        sets_lists = extra_sets_per_session[:len(date_offsets)]
        while len(sets_lists) < len(date_offsets):
            sets_lists.append(extra_sets_per_session[0])

        # Build sessions: each contains the target exercise with generated sets
        sessions: list[tuple[int, list[ExerciseEntry]]] = []
        for offset, sets in zip(date_offsets, sets_lists):
            exercise = ExerciseEntry(exercise_name=target_exercise, sets=sets)
            sessions.append((offset, [exercise]))

        seeded = await _seed_sessions(db_session, user_id, sessions)

        resolver = PreviousPerformanceResolver(db_session)
        result = await resolver.get_previous_performance(user_id, target_exercise)

        # Find the most recent session containing the target exercise
        latest_date = max(d for d, _ in seeded)
        latest_exercises = next(exs for d, exs in seeded if d == latest_date)

        # Find the target exercise entry in the latest session
        target_lower = target_exercise.lower().strip()
        matching_ex = None
        for ex in latest_exercises:
            if ex.exercise_name.lower().strip() == target_lower:
                matching_ex = ex
                break

        assert matching_ex is not None, "Target exercise should be in latest session"
        expected_last_set = matching_ex.sets[-1]

        assert result is not None, "Should return data when sessions exist"
        assert result.session_date == latest_date, (
            f"Expected date {latest_date}, got {result.session_date}"
        )
        assert result.exercise_name == target_exercise
        assert result.last_set_weight_kg == pytest.approx(
            expected_last_set.weight_kg, rel=1e-6
        ), (
            f"Expected weight {expected_last_set.weight_kg}, got {result.last_set_weight_kg}"
        )
        assert result.last_set_reps == expected_last_set.reps, (
            f"Expected reps {expected_last_set.reps}, got {result.last_set_reps}"
        )

    @pytest.mark.asyncio
    async def test_returns_none_when_no_sessions(self, db_session):
        """Returns None when user has no sessions with the exercise."""
        user_id = uuid.uuid4()
        resolver = PreviousPerformanceResolver(db_session)
        result = await resolver.get_previous_performance(user_id, "bench press")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_exercise_not_in_sessions(self, db_session):
        """Returns None when sessions exist but don't contain the target exercise."""
        user_id = uuid.uuid4()
        ts = TrainingSession(
            user_id=user_id,
            session_date=date(2024, 3, 15),
            exercises=[{
                "exercise_name": "squat",
                "sets": [{"reps": 5, "weight_kg": 100.0}],
            }],
        )
        db_session.add(ts)
        await db_session.flush()

        resolver = PreviousPerformanceResolver(db_session)
        result = await resolver.get_previous_performance(user_id, "bench press")
        assert result is None
