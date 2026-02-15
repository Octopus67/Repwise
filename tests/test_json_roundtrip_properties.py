"""Property-based tests for JSON serialization round-trip.

Tests Property 5 from the design document using Hypothesis.
Generates random valid Pydantic response models, serializes to JSON,
deserializes, and verifies equivalence.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st
from pydantic import BaseModel

from src.modules.user.schemas import (
    BodyweightLogResponse,
    UserGoalResponse,
    UserMetricResponse,
    UserProfileResponse,
)
from src.modules.nutrition.schemas import NutritionEntryResponse
from src.modules.training.schemas import TrainingSessionResponse
from src.modules.meals.schemas import CustomMealResponse
from src.modules.founder.schemas import FounderContentResponse
from src.modules.account.schemas import AccountDeletionResponse

# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_uuids = st.uuids()
_datetimes = st.datetimes(
    min_value=datetime(2020, 1, 1),
    max_value=datetime(2030, 12, 31),
    timezones=st.just(timezone.utc),
)
_dates = st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 12, 31))
_positive_floats = st.floats(min_value=0.0, max_value=10000.0, allow_nan=False, allow_infinity=False)
_strings = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "Zs"), min_codepoint=32, max_codepoint=127),
    min_size=1,
    max_size=100,
).filter(lambda s: s.strip() != "")

_micro_nutrients = st.dictionaries(
    keys=st.sampled_from(["fiber", "sodium", "iron", "calcium", "vitamin_d", "b12"]),
    values=_positive_floats,
    min_size=0,
    max_size=4,
)

_fixture_settings = h_settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture, HealthCheck.too_slow],
    deadline=None,
)


# ---------------------------------------------------------------------------
# Generic round-trip helper
# ---------------------------------------------------------------------------


def assert_json_roundtrip(model_instance: BaseModel) -> None:
    """Serialize a Pydantic model to JSON and back, verify equivalence."""
    json_str = model_instance.model_dump_json()
    reconstructed = type(model_instance).model_validate_json(json_str)

    # Compare field by field for better error messages
    for field_name in type(model_instance).model_fields:
        original_val = getattr(model_instance, field_name)
        reconstructed_val = getattr(reconstructed, field_name)
        assert original_val == reconstructed_val, (
            f"Field '{field_name}' mismatch after round-trip: "
            f"{original_val!r} != {reconstructed_val!r}"
        )


# ---------------------------------------------------------------------------
# Property 5: JSON serialization round-trip
# ---------------------------------------------------------------------------


class TestProperty5JsonSerializationRoundTrip:
    """Property 5: JSON serialization round-trip.

    For any valid API response object (Pydantic model), serializing it to
    JSON and then deserializing the JSON back SHALL produce an object
    equivalent to the original.

    **Validates: Requirements 20.3**
    """

    @_fixture_settings
    @given(
        user_id=_uuids,
        display_name=_strings,
        timezone_str=st.sampled_from(["UTC", "America/New_York", "Asia/Kolkata"]),
        currency=st.sampled_from(["USD", "INR", "EUR"]),
        region=st.sampled_from(["US", "IN", "EU"]),
    )
    def test_user_profile_response_roundtrip(
        self,
        user_id,
        display_name,
        timezone_str,
        currency,
        region,
    ):
        """UserProfileResponse round-trip.

        **Validates: Requirements 20.3**
        """
        model = UserProfileResponse(
            id=uuid.uuid4(),
            user_id=user_id,
            display_name=display_name,
            avatar_url=None,
            timezone=timezone_str,
            preferred_currency=currency,
            region=region,
            preferences={"theme": "dark"},
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        assert_json_roundtrip(model)

    @_fixture_settings
    @given(
        calories=_positive_floats,
        protein=_positive_floats,
        carbs=_positive_floats,
        fat=_positive_floats,
        meal_name=_strings,
        entry_date=_dates,
        micros=_micro_nutrients,
    )
    def test_nutrition_entry_response_roundtrip(
        self,
        calories,
        protein,
        carbs,
        fat,
        meal_name,
        entry_date,
        micros,
    ):
        """NutritionEntryResponse round-trip.

        **Validates: Requirements 20.3**
        """
        model = NutritionEntryResponse(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            meal_name=meal_name,
            calories=calories,
            protein_g=protein,
            carbs_g=carbs,
            fat_g=fat,
            micro_nutrients=micros if micros else None,
            entry_date=entry_date,
            source_meal_id=None,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        assert_json_roundtrip(model)

    @_fixture_settings
    @given(
        weight=_positive_floats,
        recorded_date=_dates,
    )
    def test_bodyweight_log_response_roundtrip(
        self,
        weight,
        recorded_date,
    ):
        """BodyweightLogResponse round-trip.

        **Validates: Requirements 20.3**
        """
        model = BodyweightLogResponse(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            weight_kg=weight,
            recorded_date=recorded_date,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        assert_json_roundtrip(model)

    @_fixture_settings
    @given(
        session_date=_dates,
    )
    def test_training_session_response_roundtrip(
        self,
        session_date,
    ):
        """TrainingSessionResponse round-trip.

        **Validates: Requirements 20.3**
        """
        from src.modules.training.schemas import ExerciseEntry, SetEntry

        model = TrainingSessionResponse(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            session_date=session_date,
            exercises=[ExerciseEntry(exercise_name="squat", sets=[SetEntry(reps=5, weight_kg=100)])],
            metadata=None,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        assert_json_roundtrip(model)

    @_fixture_settings
    @given(
        name=_strings,
        calories=_positive_floats,
        protein=_positive_floats,
        carbs=_positive_floats,
        fat=_positive_floats,
    )
    def test_custom_meal_response_roundtrip(
        self,
        name,
        calories,
        protein,
        carbs,
        fat,
    ):
        """CustomMealResponse round-trip.

        **Validates: Requirements 20.3**
        """
        model = CustomMealResponse(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            name=name,
            calories=calories,
            protein_g=protein,
            carbs_g=carbs,
            fat_g=fat,
            micro_nutrients=None,
            source_type="custom",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        assert_json_roundtrip(model)

    @_fixture_settings
    @given(
        section_key=st.sampled_from(["story", "gallery", "philosophy"]),
        locale=st.sampled_from(["en", "hi"]),
        version=st.integers(min_value=1, max_value=100),
    )
    def test_founder_content_response_roundtrip(
        self,
        section_key,
        locale,
        version,
    ):
        """FounderContentResponse round-trip.

        **Validates: Requirements 20.3**
        """
        model = FounderContentResponse(
            id=uuid.uuid4(),
            section_key=section_key,
            locale=locale,
            content={"narrative": "test", "metrics": {"before": 90, "after": 80}},
            version=version,
            updated_at=datetime.now(timezone.utc),
        )
        assert_json_roundtrip(model)

    @_fixture_settings
    @given(
        grace_days=st.just(30),
    )
    def test_account_deletion_response_roundtrip(
        self,
        grace_days,
    ):
        """AccountDeletionResponse round-trip.

        **Validates: Requirements 20.3**
        """
        now = datetime.now(timezone.utc)
        from datetime import timedelta

        model = AccountDeletionResponse(
            message="Account deactivated.",
            deleted_at=now,
            permanent_deletion_date=now + timedelta(days=grace_days),
            grace_period_days=grace_days,
        )
        assert_json_roundtrip(model)
