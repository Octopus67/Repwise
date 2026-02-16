"""Property-based and unit tests for custom exercise CRUD.

Tests the CustomExerciseService and validation logic at the service level
using the db_session fixture (async SQLite).

**Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5**
"""

from __future__ import annotations

import uuid

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st

from src.modules.training.custom_exercise_service import (
    CustomExerciseService,
    VALID_CATEGORIES,
    VALID_EQUIPMENT,
    VALID_MUSCLE_GROUPS,
    format_custom_exercise_as_dict,
    validate_custom_exercise_fields,
)


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_valid_name = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "Zs"), max_codepoint=127),
    min_size=1,
    max_size=100,
).filter(lambda s: s.strip())

_valid_muscle_group = st.sampled_from(sorted(VALID_MUSCLE_GROUPS))
_valid_equipment = st.sampled_from(sorted(VALID_EQUIPMENT))
_valid_category = st.sampled_from(sorted(VALID_CATEGORIES))
_valid_secondary_muscles = st.lists(
    st.sampled_from(sorted(VALID_MUSCLE_GROUPS)),
    min_size=0,
    max_size=4,
    unique=True,
)

_fixture_settings = h_settings(
    max_examples=20,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)


# ---------------------------------------------------------------------------
# Pure validation tests (no DB)
# ---------------------------------------------------------------------------


class TestValidateCustomExerciseFields:
    """Unit tests for the pure validation function."""

    def test_valid_input_returns_no_errors(self):
        errors = validate_custom_exercise_fields(
            name="Landmine Press",
            muscle_group="shoulders",
            equipment="barbell",
            category="compound",
        )
        assert errors == []

    def test_empty_name_returns_error(self):
        errors = validate_custom_exercise_fields(
            name="",
            muscle_group="chest",
            equipment="barbell",
        )
        assert any("Name" in e or "required" in e.lower() for e in errors)

    def test_whitespace_only_name_returns_error(self):
        errors = validate_custom_exercise_fields(
            name="   ",
            muscle_group="chest",
            equipment="barbell",
        )
        assert any("Name" in e or "required" in e.lower() for e in errors)

    def test_name_too_long_returns_error(self):
        errors = validate_custom_exercise_fields(
            name="A" * 201,
            muscle_group="chest",
            equipment="barbell",
        )
        assert any("200" in e for e in errors)

    def test_invalid_muscle_group_returns_error(self):
        errors = validate_custom_exercise_fields(
            name="Test",
            muscle_group="wings",
            equipment="barbell",
        )
        assert any("muscle group" in e.lower() for e in errors)

    def test_invalid_equipment_returns_error(self):
        errors = validate_custom_exercise_fields(
            name="Test",
            muscle_group="chest",
            equipment="sword",
        )
        assert any("equipment" in e.lower() for e in errors)

    def test_invalid_category_returns_error(self):
        errors = validate_custom_exercise_fields(
            name="Test",
            muscle_group="chest",
            equipment="barbell",
            category="explosive",
        )
        assert any("category" in e.lower() for e in errors)

    def test_invalid_secondary_muscle_returns_error(self):
        errors = validate_custom_exercise_fields(
            name="Test",
            muscle_group="chest",
            equipment="barbell",
            secondary_muscles=["wings"],
        )
        assert any("secondary" in e.lower() for e in errors)

    @given(
        name=_valid_name,
        muscle_group=_valid_muscle_group,
        equipment=_valid_equipment,
        category=_valid_category,
        secondary_muscles=_valid_secondary_muscles,
    )
    @h_settings(max_examples=30, deadline=None)
    def test_valid_inputs_always_pass_validation(
        self, name, muscle_group, equipment, category, secondary_muscles
    ):
        """**Validates: Requirements 13.2, 13.3**"""
        errors = validate_custom_exercise_fields(
            name=name,
            muscle_group=muscle_group,
            equipment=equipment,
            category=category,
            secondary_muscles=secondary_muscles,
        )
        assert errors == []


# ---------------------------------------------------------------------------
# format_custom_exercise_as_dict tests
# ---------------------------------------------------------------------------


class TestFormatCustomExerciseAsDict:
    """Tests for the dict formatting function."""

    def test_format_includes_is_custom_true(self):
        """**Validates: Requirements 13.4**"""

        class FakeExercise:
            id = uuid.uuid4()
            name = "My Exercise"
            muscle_group = "chest"
            secondary_muscles = ["triceps"]
            equipment = "barbell"
            category = "compound"
            notes = "Some notes"

        result = format_custom_exercise_as_dict(FakeExercise())
        assert result["is_custom"] is True
        assert result["image_url"] is None
        assert result["animation_url"] is None
        assert result["name"] == "My Exercise"
        assert result["id"].startswith("custom-")

    def test_format_matches_system_exercise_shape(self):
        """**Validates: Requirements 13.5**"""

        class FakeExercise:
            id = uuid.uuid4()
            name = "Custom Curl"
            muscle_group = "biceps"
            secondary_muscles = []
            equipment = "dumbbell"
            category = "isolation"
            notes = None

        result = format_custom_exercise_as_dict(FakeExercise())
        expected_keys = {
            "id", "name", "muscle_group", "secondary_muscles",
            "equipment", "category", "image_url", "animation_url",
            "description", "instructions", "tips", "is_custom",
        }
        assert set(result.keys()) == expected_keys


# ---------------------------------------------------------------------------
# Service-level CRUD tests (with DB)
# ---------------------------------------------------------------------------


class TestCustomExerciseServiceCRUD:
    """Service-level tests using the async SQLite test database."""

    @pytest.mark.asyncio
    async def test_create_returns_exercise_with_correct_fields(self, db_session):
        """**Validates: Requirements 13.2, 13.3**"""
        svc = CustomExerciseService(db_session)
        user_id = uuid.uuid4()

        exercise = await svc.create_custom_exercise(
            user_id=user_id,
            name="Landmine Press",
            muscle_group="shoulders",
            equipment="barbell",
            category="compound",
            secondary_muscles=["chest", "triceps"],
            notes="Great for shoulder health",
        )

        assert exercise.name == "Landmine Press"
        assert exercise.muscle_group == "shoulders"
        assert exercise.equipment == "barbell"
        assert exercise.category == "compound"
        assert exercise.secondary_muscles == ["chest", "triceps"]
        assert exercise.notes == "Great for shoulder health"
        assert exercise.user_id == user_id
        assert exercise.id is not None

    @pytest.mark.asyncio
    async def test_list_returns_only_current_users_exercises(self, db_session):
        """**Validates: Requirements 13.4**"""
        svc = CustomExerciseService(db_session)
        user_a = uuid.uuid4()
        user_b = uuid.uuid4()

        await svc.create_custom_exercise(
            user_id=user_a, name="User A Exercise",
            muscle_group="chest", equipment="barbell",
        )
        await svc.create_custom_exercise(
            user_id=user_b, name="User B Exercise",
            muscle_group="back", equipment="cable",
        )

        user_a_exercises = await svc.list_user_custom_exercises(user_a)
        assert len(user_a_exercises) == 1
        assert user_a_exercises[0].name == "User A Exercise"

        user_b_exercises = await svc.list_user_custom_exercises(user_b)
        assert len(user_b_exercises) == 1
        assert user_b_exercises[0].name == "User B Exercise"

    @pytest.mark.asyncio
    async def test_update_changes_name(self, db_session):
        svc = CustomExerciseService(db_session)
        user_id = uuid.uuid4()

        exercise = await svc.create_custom_exercise(
            user_id=user_id, name="Old Name",
            muscle_group="chest", equipment="barbell",
        )

        updated = await svc.update_custom_exercise(
            user_id=user_id, exercise_id=exercise.id, name="New Name",
        )
        assert updated.name == "New Name"

    @pytest.mark.asyncio
    async def test_soft_delete_removes_from_list(self, db_session):
        svc = CustomExerciseService(db_session)
        user_id = uuid.uuid4()

        exercise = await svc.create_custom_exercise(
            user_id=user_id, name="To Delete",
            muscle_group="chest", equipment="barbell",
        )

        await svc.delete_custom_exercise(user_id=user_id, exercise_id=exercise.id)

        remaining = await svc.list_user_custom_exercises(user_id)
        assert len(remaining) == 0

    @pytest.mark.asyncio
    async def test_list_as_dicts_includes_is_custom(self, db_session):
        """**Validates: Requirements 13.4, 13.5**"""
        svc = CustomExerciseService(db_session)
        user_id = uuid.uuid4()

        await svc.create_custom_exercise(
            user_id=user_id, name="Custom Press",
            muscle_group="chest", equipment="barbell",
        )

        dicts = await svc.list_user_custom_exercises_as_dicts(user_id)
        assert len(dicts) == 1
        assert dicts[0]["is_custom"] is True
        assert dicts[0]["name"] == "Custom Press"
        assert dicts[0]["image_url"] is None

    @pytest.mark.asyncio
    async def test_delete_nonexistent_raises_not_found(self, db_session):
        from src.shared.errors import NotFoundError

        svc = CustomExerciseService(db_session)
        user_id = uuid.uuid4()

        with pytest.raises(NotFoundError):
            await svc.delete_custom_exercise(user_id=user_id, exercise_id=uuid.uuid4())

    @pytest.mark.asyncio
    @given(
        name=_valid_name,
        muscle_group=_valid_muscle_group,
        equipment=_valid_equipment,
        category=_valid_category,
    )
    @_fixture_settings
    async def test_create_roundtrip_property(
        self, db_session, name, muscle_group, equipment, category
    ):
        """Property: creating then listing always returns the created exercise.

        **Validates: Requirements 13.2, 13.4**
        """
        svc = CustomExerciseService(db_session)
        user_id = uuid.uuid4()

        created = await svc.create_custom_exercise(
            user_id=user_id,
            name=name,
            muscle_group=muscle_group,
            equipment=equipment,
            category=category,
        )

        exercises = await svc.list_user_custom_exercises(user_id)
        found = [e for e in exercises if e.id == created.id]
        assert len(found) == 1
        assert found[0].name == name.strip()
        assert found[0].muscle_group == muscle_group.lower()
        assert found[0].equipment == equipment.lower()
