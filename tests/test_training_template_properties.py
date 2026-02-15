"""Property-based tests for training templates.

Tests Properties 9 and 10 from the Tier 1 Retention Features design document
using Hypothesis.
"""

from __future__ import annotations

from datetime import date

from hypothesis import given, settings as h_settings, strategies as st

from src.modules.training.schemas import (
    ExerciseEntry,
    SetEntry,
    TrainingSessionCreate,
    WorkoutTemplateResponse,
)
from src.modules.training.templates import WORKOUT_TEMPLATES, get_template_by_id


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_set_entry = st.builds(
    SetEntry,
    reps=st.integers(min_value=0, max_value=200),
    weight_kg=st.floats(min_value=0.0, max_value=500.0, allow_nan=False, allow_infinity=False),
    rpe=st.one_of(
        st.none(),
        st.floats(min_value=0.0, max_value=10.0, allow_nan=False, allow_infinity=False),
    ),
)

_exercise_entry = st.builds(
    ExerciseEntry,
    exercise_name=st.text(
        alphabet=st.characters(whitelist_categories=("L", "N", "Zs"), max_codepoint=127),
        min_size=1,
        max_size=60,
    ).filter(lambda s: s.strip()),
    sets=st.lists(_set_entry, min_size=1, max_size=8),
)

_exercise_list = st.lists(_exercise_entry, min_size=1, max_size=10)


# ---------------------------------------------------------------------------
# Property 9: Training session payload conforms to ExerciseEntry schema
# ---------------------------------------------------------------------------


class TestProperty9SchemaConformance:
    """Property 9: Training session payload conforms to ExerciseEntry schema.

    *For any* non-empty list of exercises where each exercise has a non-empty
    name and at least one set with non-negative reps and weight, serializing
    the exercise list into a TrainingSessionCreate payload SHALL produce a
    valid payload accepted by the existing POST /training/sessions endpoint
    schema.

    **Validates: Requirements 7.4**
    """

    @h_settings(max_examples=100, deadline=None)
    @given(exercises=_exercise_list)
    def test_random_exercises_produce_valid_payload(
        self, exercises: list[ExerciseEntry]
    ):
        """Generated exercise lists always produce a valid TrainingSessionCreate.

        **Validates: Requirements 7.4**
        """
        payload = TrainingSessionCreate(
            session_date=date.today(),
            exercises=exercises,
        )

        # Payload was accepted by Pydantic — verify structural invariants
        assert len(payload.exercises) == len(exercises)
        for orig, parsed in zip(exercises, payload.exercises):
            assert parsed.exercise_name == orig.exercise_name
            assert len(parsed.sets) == len(orig.sets)
            for orig_set, parsed_set in zip(orig.sets, parsed.sets):
                assert parsed_set.reps == orig_set.reps
                assert parsed_set.weight_kg == orig_set.weight_kg
                assert parsed_set.rpe == orig_set.rpe


# ---------------------------------------------------------------------------
# Property 10: Template loading populates correct exercises
# ---------------------------------------------------------------------------


class TestProperty10TemplateLoading:
    """Property 10: Template loading populates correct exercises.

    *For any* workout template, loading it SHALL produce an exercise list
    where each exercise's name and set count match the template's definition
    exactly.

    **Validates: Requirements 8.2**
    """

    def test_all_templates_validate_as_workout_template_response(self):
        """Each of the 6 templates can be validated by WorkoutTemplateResponse.

        **Validates: Requirements 8.2**
        """
        assert len(WORKOUT_TEMPLATES) == 6

        for tmpl in WORKOUT_TEMPLATES:
            response = WorkoutTemplateResponse(**tmpl)

            assert response.id == tmpl["id"]
            assert response.name == tmpl["name"]
            assert response.description == tmpl["description"]
            assert len(response.exercises) == len(tmpl["exercises"])

    def test_each_template_has_nonempty_exercises_with_sets(self):
        """Every template exercise has a non-empty name and at least 1 set.

        **Validates: Requirements 8.2**
        """
        for tmpl in WORKOUT_TEMPLATES:
            response = WorkoutTemplateResponse(**tmpl)
            assert len(response.exercises) >= 1, f"Template {tmpl['id']} has no exercises"

            for ex in response.exercises:
                assert len(ex.exercise_name.strip()) > 0, (
                    f"Template {tmpl['id']} has exercise with empty name"
                )
                assert len(ex.sets) >= 1, (
                    f"Template {tmpl['id']}, exercise '{ex.exercise_name}' has no sets"
                )

    def test_template_exercises_match_definition(self):
        """Loaded exercises match the template definition exactly.

        **Validates: Requirements 8.2**
        """
        for tmpl in WORKOUT_TEMPLATES:
            response = WorkoutTemplateResponse(**tmpl)

            for i, (ex, defn) in enumerate(zip(response.exercises, tmpl["exercises"])):
                assert ex.exercise_name == defn["exercise_name"], (
                    f"Template {tmpl['id']}, exercise {i}: "
                    f"name '{ex.exercise_name}' != '{defn['exercise_name']}'"
                )
                assert len(ex.sets) == len(defn["sets"]), (
                    f"Template {tmpl['id']}, exercise '{ex.exercise_name}': "
                    f"set count {len(ex.sets)} != {len(defn['sets'])}"
                )

    def test_get_template_by_id_returns_correct_template(self):
        """get_template_by_id returns the matching template for each known id.

        **Validates: Requirements 8.2**
        """
        for tmpl in WORKOUT_TEMPLATES:
            result = get_template_by_id(tmpl["id"])
            assert result is not None
            assert result["id"] == tmpl["id"]
            assert result["name"] == tmpl["name"]

        assert get_template_by_id("nonexistent") is None
