"""Property-based tests for e1RM History.

Tests Property 4 from the Strength Standards design document using
Hypothesis, exercised at the service level via the db_session fixture.
"""

from __future__ import annotations

import uuid
from datetime import date

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st

from src.modules.training.analytics_service import TrainingAnalyticsService
from src.modules.training.e1rm_calculator import compute_e1rm
from src.modules.training.exercise_mapping import EXERCISE_MUSCLE_MAP
from src.modules.training.models import TrainingSession
from src.modules.training.schemas import ExerciseEntry, SetEntry

_pbt_settings = h_settings(
    max_examples=100,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)

_KNOWN_EXERCISES = list(EXERCISE_MUSCLE_MAP.keys())

_set_entry_st = st.builds(
    SetEntry,
    reps=st.integers(min_value=1, max_value=30),
    weight_kg=st.floats(min_value=0.5, max_value=300.0, allow_nan=False, allow_infinity=False),
    rpe=st.none(),
)

_exercise_entry_st = st.builds(
    ExerciseEntry,
    exercise_name=st.sampled_from(_KNOWN_EXERCISES),
    sets=st.lists(_set_entry_st, min_size=1, max_size=4),
)

_session_date_st = st.dates(min_value=date(2024, 1, 1), max_value=date(2024, 6, 30))

_session_list_st = st.lists(
    st.tuples(_session_date_st, st.lists(_exercise_entry_st, min_size=1, max_size=4)),
    min_size=1,
    max_size=6,
)


async def _seed_sessions(db_session, user_id, sessions):
    for session_date, exercises in sessions:
        ts = TrainingSession(
            user_id=user_id,
            session_date=session_date,
            exercises=[ex.model_dump() for ex in exercises],
        )
        db_session.add(ts)
    await db_session.flush()


class TestProperty4E1RMHistoryOrdering:
    """Property 4: e1RM History Correctness and Ordering.

    For any set of training sessions containing a given exercise, the e1RM
    history SHALL return one point per session where e1rm_kg equals the max
    Epley e1RM across all sets of that exercise in that session, and the
    list SHALL be sorted by date ascending.

    Validates: Requirements 2.1, 2.2
    """

    @pytest.mark.asyncio
    @_pbt_settings
    @given(sessions=_session_list_st, target=st.sampled_from(_KNOWN_EXERCISES))
    async def test_e1rm_history_correctness(
        self,
        sessions: list[tuple[date, list[ExerciseEntry]]],
        target: str,
        db_session,
    ):
        user_id = uuid.uuid4()
        await _seed_sessions(db_session, user_id, sessions)

        svc = TrainingAnalyticsService(db_session)
        start = date(2024, 1, 1)
        end = date(2024, 6, 30)
        result = await svc.get_e1rm_history(user_id, target, start, end)

        target_lower = target.lower().strip()

        # Manually compute expected: best Epley per DATE containing target
        # (multiple sessions on same date → take max e1RM for that date)
        best_per_date: dict[date, float] = {}
        for session_date, exercises in sessions:
            if not (start <= session_date <= end):
                continue
            all_sets = []
            for ex in exercises:
                if ex.exercise_name.lower().strip() == target_lower:
                    all_sets.extend(ex.sets)
            if not all_sets:
                continue
            valid_sets = [s for s in all_sets if s.weight_kg > 0 and s.reps > 0]
            if not valid_sets:
                continue
            max_epley = max(compute_e1rm(s.weight_kg, s.reps).epley for s in valid_sets)
            current = best_per_date.get(session_date)
            if current is None or max_epley > current:
                best_per_date[session_date] = max_epley

        expected = list(best_per_date.items())

        assert len(result) == len(expected)

        # Verify sorted by date ascending
        for i in range(len(result) - 1):
            assert result[i].date <= result[i + 1].date

        # Verify values match
        expected_sorted = sorted(expected, key=lambda x: x[0])
        result_sorted = sorted(result, key=lambda p: p.date)
        for (exp_date, exp_e1rm), point in zip(expected_sorted, result_sorted):
            assert point.date == exp_date
            assert point.e1rm_kg == pytest.approx(round(exp_e1rm, 2), abs=0.01)


class TestEdgeCases:
    """Edge case tests for e1RM history."""

    @pytest.mark.asyncio
    async def test_empty_result_no_matching_exercise(self, db_session):
        user_id = uuid.uuid4()
        ts = TrainingSession(
            user_id=user_id,
            session_date=date(2024, 3, 1),
            exercises=[{"exercise_name": "bicep curl", "sets": [{"weight_kg": 20, "reps": 10}]}],
        )
        db_session.add(ts)
        await db_session.flush()

        svc = TrainingAnalyticsService(db_session)
        result = await svc.get_e1rm_history(user_id, "barbell bench press", date(2024, 1, 1), date(2024, 12, 31))
        assert result == []
