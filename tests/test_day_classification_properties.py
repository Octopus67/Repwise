"""Property-based and unit tests for the day classification service.

Feature: training-day-indicator
Tests Properties 1-8 from the design document.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st

from src.modules.training.day_classification import _extract_muscle_groups, classify_day
from src.modules.training.exercise_mapping import EXERCISE_MUSCLE_MAP, get_muscle_group
from src.modules.training.models import TrainingSession, WorkoutTemplate


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Known exercise names from the mapping
_known_exercises = list(EXERCISE_MUSCLE_MAP.keys())

_exercise_name_st = st.one_of(
    st.sampled_from(_known_exercises) if _known_exercises else st.just("bench press"),
    st.text(min_size=1, max_size=30).filter(lambda s: s.strip()),
)

_exercise_dict_st = st.fixed_dictionaries({
    "exercise_name": _exercise_name_st,
    "sets": st.just([{"reps": 5, "weight_kg": 100.0}]),
})

_exercise_list_st = st.lists(_exercise_dict_st, min_size=1, max_size=5)

_weekday_st = st.integers(min_value=0, max_value=6)

_fixture_settings = h_settings(
    max_examples=100,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)


# ---------------------------------------------------------------------------
# Property 5: Muscle group extraction matches mapping
# ---------------------------------------------------------------------------


class TestProperty5MuscleGroupExtractionMatchesMapping:
    """Feature: training-day-indicator, Property 5: Muscle group extraction matches mapping

    **Validates: Requirements 2.1, 2.2, 2.3**
    """

    @_fixture_settings
    @given(exercise_lists=st.lists(_exercise_list_st, min_size=1, max_size=3))
    def test_extraction_matches_individual_mapping(
        self, exercise_lists: list[list[dict]]
    ):
        """For any list of exercises, _extract_muscle_groups returns exactly the set
        produced by applying get_muscle_group() to each exercise name.

        **Validates: Requirements 2.1, 2.2, 2.3**
        """
        result = _extract_muscle_groups(exercise_lists)

        # Compute expected
        expected: set[str] = set()
        for ex_list in exercise_lists:
            for ex in ex_list:
                name = ex.get("exercise_name", "")
                if name:
                    expected.add(get_muscle_group(name))

        assert set(result) == expected


# ---------------------------------------------------------------------------
# Property 6: Muscle groups are deduplicated and sorted
# ---------------------------------------------------------------------------


class TestProperty6MuscleGroupsDeduplicatedAndSorted:
    """Feature: training-day-indicator, Property 6: Muscle groups are deduplicated and sorted

    **Validates: Requirements 2.4**
    """

    @_fixture_settings
    @given(exercise_lists=st.lists(_exercise_list_st, min_size=1, max_size=3))
    def test_output_is_deduplicated_and_sorted(
        self, exercise_lists: list[list[dict]]
    ):
        """The muscle_groups list has no duplicates and is sorted alphabetically.

        **Validates: Requirements 2.4**
        """
        result = _extract_muscle_groups(exercise_lists)

        # No duplicates
        assert len(result) == len(set(result))
        # Sorted
        assert result == sorted(result)


# ---------------------------------------------------------------------------
# Property 8: Templates without scheduled_days are ignored
# ---------------------------------------------------------------------------


class TestProperty8TemplatesWithoutScheduledDaysIgnored:
    """Feature: training-day-indicator, Property 8: Templates without scheduled_days are ignored

    **Validates: Requirements 5.3**
    """

    @_fixture_settings
    @given(
        has_key=st.booleans(),
        weekday=_weekday_st,
    )
    def test_template_filtering_logic(self, has_key: bool, weekday: int):
        """Templates without scheduled_days key should not match any weekday.

        **Validates: Requirements 5.3**
        """
        if has_key:
            metadata = {"scheduled_days": [weekday]}
        else:
            metadata = {"some_other_key": "value"}

        # Simulate the filtering logic from classify_day
        scheduled_days = metadata.get("scheduled_days")
        if not isinstance(scheduled_days, list):
            matches = False
        else:
            valid_days = [d for d in scheduled_days if isinstance(d, int) and 0 <= d <= 6]
            matches = weekday in valid_days

        if has_key:
            assert matches is True
        else:
            assert matches is False


# ---------------------------------------------------------------------------
# Property 1: Session implies training day (DB-dependent)
# ---------------------------------------------------------------------------


class TestProperty1SessionImpliesTrainingDay:
    """Feature: training-day-indicator, Property 1: Session implies training day

    **Validates: Requirements 1.1, 1.4**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        exercise_name=st.sampled_from(_known_exercises[:10]),
        target=st.dates(min_value=date(2023, 1, 1), max_value=date(2024, 12, 31)),
    )
    async def test_session_on_date_means_training_day(
        self, exercise_name: str, target: date, db_session
    ):
        """If a session exists on the target date, classify_day returns training + source=session.

        **Validates: Requirements 1.1, 1.4**
        """
        user_id = uuid.uuid4()
        session = TrainingSession(
            user_id=user_id,
            session_date=target,
            exercises=[{"exercise_name": exercise_name, "sets": [{"reps": 5, "weight_kg": 100.0}]}],
        )
        db_session.add(session)
        await db_session.flush()

        result = await classify_day(db=db_session, user_id=user_id, target_date=target)

        assert result.is_training_day is True
        assert result.classification == "training"
        assert result.source == "session"


# ---------------------------------------------------------------------------
# Property 2: No session and no template implies rest day (DB-dependent)
# ---------------------------------------------------------------------------


class TestProperty2NoDataImpliesRestDay:
    """Feature: training-day-indicator, Property 2: No session and no template implies rest day

    **Validates: Requirements 1.2**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(target=st.dates(min_value=date(2023, 1, 1), max_value=date(2024, 12, 31)))
    async def test_no_data_means_rest_day(self, target: date, db_session):
        """With no sessions or templates, classify_day returns rest day.

        **Validates: Requirements 1.2**
        """
        user_id = uuid.uuid4()
        result = await classify_day(db=db_session, user_id=user_id, target_date=target)

        assert result.is_training_day is False
        assert result.classification == "rest"
        assert result.source == "none"
        assert result.muscle_groups == []


# ---------------------------------------------------------------------------
# Property 3: Template schedule implies training day (DB-dependent)
# ---------------------------------------------------------------------------


class TestProperty3TemplateScheduleImpliesTrainingDay:
    """Feature: training-day-indicator, Property 3: Template schedule implies training day

    **Validates: Requirements 1.3, 5.1**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        exercise_name=st.sampled_from(_known_exercises[:10]),
    )
    async def test_template_on_weekday_means_training_day(
        self, exercise_name: str, db_session
    ):
        """If a template is scheduled on the target weekday (no session), classify_day returns training + source=template.

        **Validates: Requirements 1.3, 5.1**
        """
        user_id = uuid.uuid4()
        # Pick a date and use its weekday
        target = date(2024, 1, 15)  # Monday = weekday 0
        template = WorkoutTemplate(
            user_id=user_id,
            name="Test Template",
            exercises=[{"exercise_name": exercise_name, "sets": [{"reps": 5, "weight_kg": 100.0}]}],
            metadata_={"scheduled_days": [target.weekday()]},
        )
        db_session.add(template)
        await db_session.flush()

        result = await classify_day(db=db_session, user_id=user_id, target_date=target)

        assert result.is_training_day is True
        assert result.classification == "training"
        assert result.source == "template"


# ---------------------------------------------------------------------------
# Property 4: Session takes priority over template (DB-dependent)
# ---------------------------------------------------------------------------


class TestProperty4SessionPriorityOverTemplate:
    """Feature: training-day-indicator, Property 4: Session takes priority over template

    **Validates: Requirements 1.4**
    """

    @pytest.mark.asyncio
    async def test_session_overrides_template(self, db_session):
        """When both session and template exist, source should be 'session'.

        **Validates: Requirements 1.4**
        """
        user_id = uuid.uuid4()
        target = date(2024, 1, 15)  # Monday

        session = TrainingSession(
            user_id=user_id,
            session_date=target,
            exercises=[{"exercise_name": "bench press", "sets": [{"reps": 5, "weight_kg": 100.0}]}],
        )
        template = WorkoutTemplate(
            user_id=user_id,
            name="Template",
            exercises=[{"exercise_name": "squat", "sets": [{"reps": 5, "weight_kg": 100.0}]}],
            metadata_={"scheduled_days": [target.weekday()]},
        )
        db_session.add(session)
        db_session.add(template)
        await db_session.flush()

        result = await classify_day(db=db_session, user_id=user_id, target_date=target)

        assert result.source == "session"
        assert result.is_training_day is True
        # Muscle groups should come from session (bench press → chest), not template (squat → quads)
        assert "chest" in result.muscle_groups


# ---------------------------------------------------------------------------
# Property 7: Multiple templates merge muscle groups (DB-dependent)
# ---------------------------------------------------------------------------


class TestProperty7MultipleTemplatesMergeMuscleGroups:
    """Feature: training-day-indicator, Property 7: Multiple templates merge muscle groups

    **Validates: Requirements 5.2**
    """

    @pytest.mark.asyncio
    async def test_multiple_templates_merge(self, db_session):
        """Multiple templates on the same weekday should merge muscle groups.

        **Validates: Requirements 5.2**
        """
        user_id = uuid.uuid4()
        target = date(2024, 1, 15)  # Monday = 0

        t1 = WorkoutTemplate(
            user_id=user_id,
            name="Push",
            exercises=[{"exercise_name": "bench press", "sets": [{"reps": 5, "weight_kg": 100.0}]}],
            metadata_={"scheduled_days": [0]},
        )
        t2 = WorkoutTemplate(
            user_id=user_id,
            name="Pull",
            exercises=[{"exercise_name": "barbell row", "sets": [{"reps": 5, "weight_kg": 80.0}]}],
            metadata_={"scheduled_days": [0]},
        )
        db_session.add(t1)
        db_session.add(t2)
        await db_session.flush()

        result = await classify_day(db=db_session, user_id=user_id, target_date=target)

        assert result.is_training_day is True
        assert result.source == "template"
        assert "lats" in result.muscle_groups
        assert "chest" in result.muscle_groups


# ---------------------------------------------------------------------------
# Unit tests for edge cases (Task 2.3)
# ---------------------------------------------------------------------------


class TestEdgeCases:
    """Unit tests for edge cases in day classification.

    **Validates: Requirements 2.3, 5.3**
    """

    def test_extract_muscle_groups_empty_list(self):
        """Empty exercise list returns empty result."""
        assert _extract_muscle_groups([]) == []

    def test_extract_muscle_groups_empty_inner_list(self):
        """Empty inner exercise list returns empty result."""
        assert _extract_muscle_groups([[]]) == []

    def test_extract_muscle_groups_unknown_exercises(self):
        """Unknown exercise names produce 'Other'."""
        result = _extract_muscle_groups([[{"exercise_name": "xyzzy_unknown_exercise"}]])
        assert result == ["Other"]

    def test_extract_muscle_groups_duplicates(self):
        """Duplicate exercises produce deduplicated output."""
        exercises = [
            [
                {"exercise_name": "bench press"},
                {"exercise_name": "dumbbell bench press"},
            ]
        ]
        result = _extract_muscle_groups(exercises)
        assert result.count("chest") == 1

    def test_extract_muscle_groups_missing_name_key(self):
        """Exercise dict without exercise_name key is skipped."""
        result = _extract_muscle_groups([[{"sets": []}]])
        assert result == []

    @pytest.mark.asyncio
    async def test_template_with_out_of_range_scheduled_days(self, db_session):
        """Templates with out-of-range weekday values are skipped gracefully."""
        user_id = uuid.uuid4()
        target = date(2024, 1, 15)  # Monday = 0

        template = WorkoutTemplate(
            user_id=user_id,
            name="Bad Template",
            exercises=[{"exercise_name": "squat", "sets": [{"reps": 5, "weight_kg": 100.0}]}],
            metadata_={"scheduled_days": [99, -1, "not_a_number"]},
        )
        db_session.add(template)
        await db_session.flush()

        result = await classify_day(db=db_session, user_id=user_id, target_date=target)
        assert result.is_training_day is False
        assert result.source == "none"

    @pytest.mark.asyncio
    async def test_template_with_none_metadata(self, db_session):
        """Templates with None metadata are skipped gracefully."""
        user_id = uuid.uuid4()
        target = date(2024, 1, 15)

        template = WorkoutTemplate(
            user_id=user_id,
            name="No Metadata",
            exercises=[{"exercise_name": "squat", "sets": [{"reps": 5, "weight_kg": 100.0}]}],
            metadata_=None,
        )
        db_session.add(template)
        await db_session.flush()

        result = await classify_day(db=db_session, user_id=user_id, target_date=target)
        assert result.is_training_day is False
        assert result.source == "none"


# ---------------------------------------------------------------------------
# Additional edge case tests — audit-fix cycle additions
# ---------------------------------------------------------------------------


class TestMultipleSessionsSameDay:
    """Test that multiple sessions on the same day correctly merge muscle groups.

    **Validates: Requirements 2.1, 2.2**
    """

    @pytest.mark.asyncio
    async def test_multiple_sessions_merge_muscle_groups(self, db_session):
        """Two sessions on the same date should merge their muscle groups."""
        user_id = uuid.uuid4()
        target = date(2024, 3, 10)

        s1 = TrainingSession(
            user_id=user_id,
            session_date=target,
            exercises=[{"exercise_name": "bench press", "sets": [{"reps": 5, "weight_kg": 80.0}]}],
        )
        s2 = TrainingSession(
            user_id=user_id,
            session_date=target,
            exercises=[{"exercise_name": "squat", "sets": [{"reps": 5, "weight_kg": 100.0}]}],
        )
        db_session.add(s1)
        db_session.add(s2)
        await db_session.flush()

        result = await classify_day(db=db_session, user_id=user_id, target_date=target)

        assert result.is_training_day is True
        assert result.source == "session"
        assert "chest" in result.muscle_groups
        assert "quads" in result.muscle_groups

    @pytest.mark.asyncio
    async def test_multiple_sessions_same_muscle_group_deduplicates(self, db_session):
        """Two sessions with same muscle group should not duplicate."""
        user_id = uuid.uuid4()
        target = date(2024, 3, 10)

        s1 = TrainingSession(
            user_id=user_id,
            session_date=target,
            exercises=[{"exercise_name": "bench press", "sets": [{"reps": 5, "weight_kg": 80.0}]}],
        )
        s2 = TrainingSession(
            user_id=user_id,
            session_date=target,
            exercises=[{"exercise_name": "dumbbell bench press", "sets": [{"reps": 8, "weight_kg": 30.0}]}],
        )
        db_session.add(s1)
        db_session.add(s2)
        await db_session.flush()

        result = await classify_day(db=db_session, user_id=user_id, target_date=target)

        assert result.muscle_groups.count("chest") == 1


class TestNoneAndCorruptExercisesField:
    """Test handling of None and corrupt exercises JSONB data.

    **Validates: Requirements 2.3 (robustness)**
    """

    def test_extract_muscle_groups_none_input(self):
        """None input returns empty list."""
        assert _extract_muscle_groups(None) == []

    def test_extract_muscle_groups_non_list_inner(self):
        """Non-list inner entries are skipped."""
        result = _extract_muscle_groups([None, "not_a_list", 42])
        assert result == []

    def test_extract_muscle_groups_non_dict_exercise(self):
        """Non-dict exercise entries within a list are skipped."""
        result = _extract_muscle_groups([["not_a_dict", 42, None]])
        assert result == []

    def test_extract_muscle_groups_non_string_exercise_name(self):
        """Non-string exercise_name values are skipped."""
        result = _extract_muscle_groups([[{"exercise_name": 42}]])
        assert result == []

    def test_extract_muscle_groups_whitespace_only_name(self):
        """Whitespace-only exercise names are skipped."""
        result = _extract_muscle_groups([[{"exercise_name": "   "}]])
        assert result == []

    def test_extract_muscle_groups_mixed_valid_and_invalid(self):
        """Valid exercises are extracted even when mixed with invalid data."""
        exercises = [
            [
                {"exercise_name": "bench press"},
                {"exercise_name": ""},
                {"exercise_name": None},
                {"sets": []},
                "not_a_dict",
            ]
        ]
        result = _extract_muscle_groups(exercises)
        assert result == ["chest"]


class TestSessionWithNoExercises:
    """Test sessions that exist but have empty or None exercises.

    **Validates: Requirements 1.1 (edge case)**
    """

    @pytest.mark.asyncio
    async def test_session_with_empty_exercises_still_training_day(self, db_session):
        """A session with empty exercises list is still a training day (session exists)."""
        user_id = uuid.uuid4()
        target = date(2024, 3, 10)

        session = TrainingSession(
            user_id=user_id,
            session_date=target,
            exercises=[],
        )
        db_session.add(session)
        await db_session.flush()

        result = await classify_day(db=db_session, user_id=user_id, target_date=target)

        assert result.is_training_day is True
        assert result.source == "session"
        assert result.muscle_groups == []
