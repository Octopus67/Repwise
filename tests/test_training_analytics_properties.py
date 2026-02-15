"""Property-based tests for the Training Analytics Service.

Tests Properties 1–5 from the Product Polish V2 design document using
Hypothesis, exercised at the service level via the db_session fixture.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date, timedelta

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st

from src.modules.training.analytics_schemas import (
    MuscleGroupFrequency,
    StrengthProgressionPoint,
    VolumeTrendPoint,
)
from src.modules.training.analytics_service import TrainingAnalyticsService, _iso_week_start
from src.modules.training.exercise_mapping import (
    COMPOUND_EXERCISES,
    EXERCISE_MUSCLE_MAP,
    get_muscle_group,
    is_compound,
)
from src.modules.training.models import TrainingSession
from src.modules.training.schemas import ExerciseEntry, SetEntry


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_KNOWN_EXERCISES = list(EXERCISE_MUSCLE_MAP.keys())
_KNOWN_MUSCLE_GROUPS = sorted(set(EXERCISE_MUSCLE_MAP.values()))

_set_entry_st = st.builds(
    SetEntry,
    reps=st.integers(min_value=1, max_value=50),
    weight_kg=st.floats(min_value=0.5, max_value=300.0, allow_nan=False, allow_infinity=False),
    rpe=st.none(),
)

_known_exercise_name_st = st.sampled_from(_KNOWN_EXERCISES)

_exercise_entry_st = st.builds(
    ExerciseEntry,
    exercise_name=_known_exercise_name_st,
    sets=st.lists(_set_entry_st, min_size=1, max_size=4),
)

_session_date_st = st.dates(min_value=date(2024, 1, 1), max_value=date(2024, 6, 30))

_session_list_st = st.lists(
    st.tuples(_session_date_st, st.lists(_exercise_entry_st, min_size=1, max_size=4)),
    min_size=1,
    max_size=6,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _seed_sessions(
    db_session, user_id: uuid.UUID, sessions: list[tuple[date, list[ExerciseEntry]]]
) -> None:
    """Insert training sessions directly into the database."""
    for session_date, exercises in sessions:
        ts = TrainingSession(
            user_id=user_id,
            session_date=session_date,
            exercises=[ex.model_dump() for ex in exercises],
        )
        db_session.add(ts)
    await db_session.flush()


# ---------------------------------------------------------------------------
# Shared Hypothesis settings — 100 examples minimum
# ---------------------------------------------------------------------------

_pbt_settings = h_settings(
    max_examples=100,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)


# ---------------------------------------------------------------------------
# Property 1: Volume computation correctness
# ---------------------------------------------------------------------------


class TestProperty1VolumeComputation:
    """Property 1: Volume computation correctness.

    For any set of training sessions with known exercises, the total volume
    returned by the Training Analytics Service for a date range SHALL equal
    the sum of (reps × weight_kg) across all sets in all exercises in all
    sessions within that range.

    **Validates: Requirements 1.1**
    """

    @pytest.mark.asyncio
    @_pbt_settings
    @given(sessions=_session_list_st)
    async def test_volume_equals_manual_sum(
        self,
        sessions: list[tuple[date, list[ExerciseEntry]]],
        db_session,
    ):
        """Computed volume matches manual sum of reps × weight_kg.

        **Validates: Requirements 1.1**
        """
        user_id = uuid.uuid4()
        await _seed_sessions(db_session, user_id, sessions)

        svc = TrainingAnalyticsService(db_session)
        start = date(2024, 1, 1)
        end = date(2024, 6, 30)
        result = await svc.get_volume_trend(user_id, start, end)

        # Manual computation: aggregate volume per day
        expected_daily: dict[date, float] = defaultdict(float)
        for session_date, exercises in sessions:
            if start <= session_date <= end:
                for ex in exercises:
                    for s in ex.sets:
                        expected_daily[session_date] += s.reps * s.weight_kg

        result_daily = {p.date: p.total_volume for p in result}

        for d, expected_vol in expected_daily.items():
            assert d in result_daily, f"Missing date {d} in result"
            assert result_daily[d] == pytest.approx(expected_vol, rel=1e-6), (
                f"Volume mismatch on {d}: expected {expected_vol}, got {result_daily[d]}"
            )

        # No extra dates in result
        for p in result:
            assert p.date in expected_daily


# ---------------------------------------------------------------------------
# Property 2: Volume muscle group filtering
# ---------------------------------------------------------------------------


class TestProperty2VolumeMuscleGroupFiltering:
    """Property 2: Volume muscle group filtering.

    For any set of training sessions and any muscle group filter, the volume
    returned SHALL only include contributions from exercises that map to the
    specified muscle group.

    **Validates: Requirements 1.3**
    """

    @pytest.mark.asyncio
    @_pbt_settings
    @given(
        sessions=_session_list_st,
        muscle_group=st.sampled_from(_KNOWN_MUSCLE_GROUPS),
    )
    async def test_filtered_volume_matches_group_only(
        self,
        sessions: list[tuple[date, list[ExerciseEntry]]],
        muscle_group: str,
        db_session,
    ):
        """Filtered volume only includes exercises mapped to the given group.

        **Validates: Requirements 1.3**
        """
        user_id = uuid.uuid4()
        await _seed_sessions(db_session, user_id, sessions)

        svc = TrainingAnalyticsService(db_session)
        start = date(2024, 1, 1)
        end = date(2024, 6, 30)
        result = await svc.get_volume_trend(user_id, start, end, muscle_group=muscle_group)

        # Manual computation for the specific muscle group
        expected_daily: dict[date, float] = defaultdict(float)
        for session_date, exercises in sessions:
            if start <= session_date <= end:
                for ex in exercises:
                    if get_muscle_group(ex.exercise_name) == muscle_group:
                        for s in ex.sets:
                            expected_daily[session_date] += s.reps * s.weight_kg

        result_daily = {p.date: p.total_volume for p in result}

        for d, expected_vol in expected_daily.items():
            assert d in result_daily
            assert result_daily[d] == pytest.approx(expected_vol, rel=1e-6)

        # No extra dates
        for p in result:
            assert p.date in expected_daily


# ---------------------------------------------------------------------------
# Property 3: Strength progression best-set computation
# ---------------------------------------------------------------------------


class TestProperty3StrengthProgressionBestSet:
    """Property 3: Strength progression best-set computation.

    For any set of training sessions containing a given exercise, the
    strength progression time series SHALL return one point per session
    where best_weight_kg and best_reps correspond to the set with the
    highest (weight_kg × reps) product.

    **Validates: Requirements 2.1**
    """

    @pytest.mark.asyncio
    @_pbt_settings
    @given(
        sessions=_session_list_st,
        target_exercise=_known_exercise_name_st,
    )
    async def test_best_set_matches_max_product(
        self,
        sessions: list[tuple[date, list[ExerciseEntry]]],
        target_exercise: str,
        db_session,
    ):
        """Each point's best_weight_kg × best_reps equals the max product for that session.

        The service returns one point per session row (not per date), so
        multiple sessions on the same date produce multiple points.

        **Validates: Requirements 2.1**
        """
        user_id = uuid.uuid4()
        await _seed_sessions(db_session, user_id, sessions)

        svc = TrainingAnalyticsService(db_session)
        start = date(2024, 1, 1)
        end = date(2024, 6, 30)
        result = await svc.get_strength_progression(user_id, target_exercise, start, end)

        target_lower = target_exercise.lower().strip()

        # Compute expected best-set products per session row.
        # Each input tuple is one session row; collect the max product per row
        # that contains the target exercise.
        expected_products: list[tuple[date, float]] = []
        for session_date, exercises in sessions:
            if not (start <= session_date <= end):
                continue
            best_product = -1.0
            for ex in exercises:
                if ex.exercise_name.lower().strip() != target_lower:
                    continue
                for s in ex.sets:
                    product = s.weight_kg * s.reps
                    if product > best_product:
                        best_product = product
            if best_product >= 0:
                expected_products.append((session_date, best_product))

        # The number of result points should match the number of session rows
        # that contained the target exercise.
        assert len(result) == len(expected_products)

        # Sort both by (date, product) for stable comparison
        expected_sorted = sorted(expected_products, key=lambda x: (x[0], x[1]))
        result_sorted = sorted(result, key=lambda p: (p.date, p.best_weight_kg * p.best_reps))

        for (exp_date, exp_product), point in zip(expected_sorted, result_sorted):
            assert point.date == exp_date
            actual_product = point.best_weight_kg * point.best_reps
            assert actual_product == pytest.approx(exp_product, rel=1e-6)


# ---------------------------------------------------------------------------
# Property 4: Muscle group frequency computation
# ---------------------------------------------------------------------------


class TestProperty4MuscleGroupFrequency:
    """Property 4: Muscle group frequency computation.

    For any set of training sessions over a date range, the muscle group
    frequency data SHALL report a session_count per muscle group per ISO
    week that equals the number of distinct sessions in that week containing
    at least one exercise mapped to that muscle group.

    **Validates: Requirements 3.1**
    """

    @pytest.mark.asyncio
    @_pbt_settings
    @given(sessions=_session_list_st)
    async def test_frequency_matches_distinct_session_count(
        self,
        sessions: list[tuple[date, list[ExerciseEntry]]],
        db_session,
    ):
        """session_count per group per week equals distinct session dates with that group.

        **Validates: Requirements 3.1**
        """
        user_id = uuid.uuid4()
        await _seed_sessions(db_session, user_id, sessions)

        svc = TrainingAnalyticsService(db_session)
        start = date(2024, 1, 1)
        end = date(2024, 6, 30)
        result = await svc.get_muscle_group_frequency(user_id, start, end)

        # Manual computation
        expected: dict[tuple[str, date], set[date]] = defaultdict(set)
        for session_date, exercises in sessions:
            if not (start <= session_date <= end):
                continue
            week_start = _iso_week_start(session_date)
            seen_groups: set[str] = set()
            for ex in exercises:
                mg = get_muscle_group(ex.exercise_name)
                if mg not in seen_groups:
                    seen_groups.add(mg)
                    expected[(mg, week_start)].add(session_date)

        result_map = {(f.muscle_group, f.week_start): f.session_count for f in result}

        for (mg, ws), session_dates in expected.items():
            key = (mg, ws)
            assert key in result_map, f"Missing {key} in frequency result"
            assert result_map[key] == len(session_dates), (
                f"Frequency mismatch for {key}: expected {len(session_dates)}, got {result_map[key]}"
            )

        # No extra entries
        for f in result:
            assert (f.muscle_group, f.week_start) in expected


# ---------------------------------------------------------------------------
# Property 5: Exercise-to-muscle-group mapping completeness
# ---------------------------------------------------------------------------


class TestProperty5ExerciseMapping:
    """Property 5: Exercise-to-muscle-group mapping completeness.

    For any exercise name present in the EXERCISE_MUSCLE_MAP, the mapping
    function SHALL return the corresponding muscle group. For any exercise
    name not in the map, the mapping function SHALL return "Other".

    **Validates: Requirements 3.2, 3.3**
    """

    @_pbt_settings
    @given(exercise_name=st.sampled_from(_KNOWN_EXERCISES))
    def test_known_exercise_returns_correct_group(self, exercise_name: str):
        """Known exercises return their mapped muscle group.

        **Validates: Requirements 3.2**
        """
        expected = EXERCISE_MUSCLE_MAP[exercise_name]
        assert get_muscle_group(exercise_name) == expected

    @_pbt_settings
    @given(
        exercise_name=st.text(
            alphabet=st.characters(whitelist_categories=("L",), max_codepoint=127),
            min_size=1,
            max_size=30,
        ).filter(lambda s: s.lower().strip() not in EXERCISE_MUSCLE_MAP)
    )
    def test_unknown_exercise_returns_other(self, exercise_name: str):
        """Unknown exercises return "Other".

        **Validates: Requirements 3.3**
        """
        assert get_muscle_group(exercise_name) == "Other"

    @_pbt_settings
    @given(exercise_name=st.sampled_from(sorted(COMPOUND_EXERCISES)))
    def test_compound_exercises_identified(self, exercise_name: str):
        """Compound exercises are correctly identified.

        **Validates: Requirements 3.2**
        """
        assert is_compound(exercise_name) is True

    @_pbt_settings
    @given(
        exercise_name=st.text(
            alphabet=st.characters(whitelist_categories=("L",), max_codepoint=127),
            min_size=1,
            max_size=30,
        ).filter(lambda s: s.lower().strip() not in COMPOUND_EXERCISES)
    )
    def test_non_compound_exercises_not_compound(self, exercise_name: str):
        """Non-compound exercises return False for is_compound.

        **Validates: Requirements 3.2**
        """
        assert is_compound(exercise_name) is False
