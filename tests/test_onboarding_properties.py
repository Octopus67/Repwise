"""Property-based tests for the onboarding module.

Tests Properties 2, 12, and 13 from the Tier 1 Retention Features design document
using Hypothesis.
"""

from __future__ import annotations

from datetime import date

import pytest
from hypothesis import given, settings as h_settings, strategies as st
from pydantic import ValidationError

from src.modules.adaptive.engine import AdaptiveInput, compute_snapshot
from src.modules.onboarding.schemas import OnboardingCompleteRequest
from src.modules.user.schemas import UserGoalSet, UserMetricCreate
from src.shared.types import ActivityLevel, GoalType


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_goal_types = st.sampled_from(list(GoalType))
_activity_levels = st.sampled_from(list(ActivityLevel))
_sexes = st.sampled_from(["male", "female"])

# Wide-range floats/ints that span both valid and invalid territory
_any_height = st.floats(min_value=0.0, max_value=500.0, allow_nan=False, allow_infinity=False)
_any_weight = st.floats(min_value=0.0, max_value=600.0, allow_nan=False, allow_infinity=False)
_any_body_fat = st.one_of(
    st.none(),
    st.floats(min_value=0.0, max_value=100.0, allow_nan=False, allow_infinity=False),
)
_any_age = st.integers(min_value=0, max_value=200)

# Valid-only strategies (within OnboardingCompleteRequest constraints)
_valid_height = st.floats(min_value=100.0, max_value=250.0, allow_nan=False, allow_infinity=False)
_valid_weight = st.floats(min_value=30.0, max_value=300.0, allow_nan=False, allow_infinity=False)
_valid_body_fat = st.one_of(
    st.none(),
    st.floats(min_value=3.0, max_value=60.0, allow_nan=False, allow_infinity=False),
)
_valid_age = st.integers(min_value=13, max_value=120)
_valid_goal_rate = st.floats(min_value=-2.0, max_value=2.0, allow_nan=False, allow_infinity=False)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_valid_height(h: float) -> bool:
    return 100.0 <= h <= 250.0


def _is_valid_weight(w: float) -> bool:
    return 30.0 <= w <= 300.0


def _is_valid_body_fat(bf: float | None) -> bool:
    if bf is None:
        return True
    return 3.0 <= bf <= 60.0


def _is_valid_age(a: int) -> bool:
    return 13 <= a <= 120


# ---------------------------------------------------------------------------
# Property 2: Body stats validation accepts only in-range values
# ---------------------------------------------------------------------------


class TestProperty2BodyStatsValidation:
    """Property 2: Body stats validation accepts only in-range values.

    For any body stats input (height_cm, weight_kg, body_fat_pct, age_years),
    the validation function SHALL accept the input if and only if height is in
    [100, 250], weight is in [30, 300], body fat is in [3, 60] (or null), and
    age is in [13, 120].

    **Validates: Requirements 3.2, 3.3**
    """

    @h_settings(max_examples=200)
    @given(
        height=_any_height,
        weight=_any_weight,
        body_fat=_any_body_fat,
        age=_any_age,
        goal_type=_goal_types,
        activity_level=_activity_levels,
        sex=_sexes,
        goal_rate=_valid_goal_rate,
    )
    def test_body_stats_validation(
        self,
        height: float,
        weight: float,
        body_fat: float | None,
        age: int,
        goal_type: GoalType,
        activity_level: ActivityLevel,
        sex: str,
        goal_rate: float,
    ):
        """OnboardingCompleteRequest accepts iff all body stats are in range.

        **Validates: Requirements 3.2, 3.3**
        """
        should_accept = (
            _is_valid_height(height)
            and _is_valid_weight(weight)
            and _is_valid_body_fat(body_fat)
            and _is_valid_age(age)
        )

        payload = {
            "goal_type": goal_type,
            "height_cm": height,
            "weight_kg": weight,
            "body_fat_pct": body_fat,
            "age_years": age,
            "sex": sex,
            "activity_level": activity_level,
            "goal_rate_per_week": goal_rate,
        }

        if should_accept:
            req = OnboardingCompleteRequest(**payload)
            assert req.height_cm == height
            assert req.weight_kg == weight
            assert req.body_fat_pct == body_fat
            assert req.age_years == age
        else:
            with pytest.raises(ValidationError):
                OnboardingCompleteRequest(**payload)


# ---------------------------------------------------------------------------
# Property 12: Onboarding snapshot reflects submitted body stats
# ---------------------------------------------------------------------------


class TestProperty12SnapshotReflectsInput:
    """Property 12: Onboarding snapshot reflects submitted body stats.

    For any valid onboarding request, the resulting AdaptiveSnapshot SHALL
    contain non-zero target_calories and target_protein_g computed from the
    submitted body stats.

    **Validates: Requirements 9.3**
    """

    @h_settings(max_examples=100)
    @given(
        height=_valid_height,
        weight=_valid_weight,
        body_fat=_valid_body_fat,
        age=_valid_age,
        goal_type=_goal_types,
        activity_level=_activity_levels,
        sex=_sexes,
        goal_rate=_valid_goal_rate,
    )
    def test_snapshot_has_nonzero_targets(
        self,
        height: float,
        weight: float,
        body_fat: float | None,
        age: int,
        goal_type: GoalType,
        activity_level: ActivityLevel,
        sex: str,
        goal_rate: float,
    ):
        """compute_snapshot with valid onboarding inputs produces non-zero targets.

        **Validates: Requirements 9.3**
        """
        today = date.today()
        engine_input = AdaptiveInput(
            weight_kg=weight,
            height_cm=height,
            age_years=age,
            sex=sex,
            activity_level=activity_level,
            goal_type=goal_type,
            goal_rate_per_week=goal_rate,
            bodyweight_history=[(today, weight)],
            training_load_score=0.0,
        )
        output = compute_snapshot(engine_input)

        assert output.target_calories > 0, (
            f"Expected positive target_calories, got {output.target_calories}"
        )
        assert output.target_protein_g > 0, (
            f"Expected positive target_protein_g, got {output.target_protein_g}"
        )
        assert output.target_carbs_g >= 0, (
            f"Expected non-negative target_carbs_g, got {output.target_carbs_g}"
        )
        assert output.target_fat_g > 0, (
            f"Expected positive target_fat_g, got {output.target_fat_g}"
        )


# ---------------------------------------------------------------------------
# Property 13: Onboarding validation matches existing schema constraints
# ---------------------------------------------------------------------------


class TestProperty13ValidationConsistency:
    """Property 13: Onboarding validation matches existing schema constraints.

    For any input values, the onboarding endpoint's validation SHALL accept
    or reject the same inputs as the combination of UserMetricCreate (for body
    stats fields) and UserGoalSet (for goal fields) schemas. No input accepted
    by onboarding SHALL be rejected by the individual schemas, and vice versa.

    **Validates: Requirements 9.6**
    """

    @h_settings(max_examples=200)
    @given(
        height=_valid_height,
        weight=_valid_weight,
        body_fat=_valid_body_fat,
        age=_valid_age,
        goal_type=_goal_types,
        activity_level=_activity_levels,
        sex=_sexes,
        goal_rate=_valid_goal_rate,
    )
    def test_accepted_onboarding_accepted_by_individual_schemas(
        self,
        height: float,
        weight: float,
        body_fat: float | None,
        age: int,
        goal_type: GoalType,
        activity_level: ActivityLevel,
        sex: str,
        goal_rate: float,
    ):
        """Any input accepted by OnboardingCompleteRequest must also be accepted
        by UserMetricCreate (for body stats) and UserGoalSet (for goal fields).

        **Validates: Requirements 9.6**
        """
        # This should succeed — we're using valid-range strategies
        req = OnboardingCompleteRequest(
            goal_type=goal_type,
            height_cm=height,
            weight_kg=weight,
            body_fat_pct=body_fat,
            age_years=age,
            sex=sex,
            activity_level=activity_level,
            goal_rate_per_week=goal_rate,
        )

        # The same body-stat fields must be accepted by UserMetricCreate
        metric = UserMetricCreate(
            height_cm=req.height_cm,
            weight_kg=req.weight_kg,
            body_fat_pct=req.body_fat_pct,
            activity_level=req.activity_level,
        )
        assert metric.height_cm == req.height_cm
        assert metric.weight_kg == req.weight_kg

        # The same goal fields must be accepted by UserGoalSet
        goal = UserGoalSet(
            goal_type=req.goal_type,
            goal_rate_per_week=req.goal_rate_per_week,
        )
        assert goal.goal_type == req.goal_type
        assert goal.goal_rate_per_week == req.goal_rate_per_week

    @h_settings(max_examples=200)
    @given(
        height=_any_height,
        weight=_any_weight,
        body_fat=_any_body_fat,
        age=_any_age,
        goal_type=_goal_types,
        activity_level=_activity_levels,
        sex=_sexes,
        goal_rate=_valid_goal_rate,
    )
    def test_onboarding_stricter_than_metric_create(
        self,
        height: float,
        weight: float,
        body_fat: float | None,
        age: int,
        goal_type: GoalType,
        activity_level: ActivityLevel,
        sex: str,
        goal_rate: float,
    ):
        """OnboardingCompleteRequest has stricter constraints than UserMetricCreate
        for body stats (e.g. height [100,250] vs gt=0). Any value accepted by
        onboarding must also be accepted by UserMetricCreate.

        **Validates: Requirements 9.6**
        """
        payload = {
            "goal_type": goal_type,
            "height_cm": height,
            "weight_kg": weight,
            "body_fat_pct": body_fat,
            "age_years": age,
            "sex": sex,
            "activity_level": activity_level,
            "goal_rate_per_week": goal_rate,
        }

        try:
            req = OnboardingCompleteRequest(**payload)
        except ValidationError:
            # Onboarding rejected it — that's fine, no consistency check needed
            return

        # Onboarding accepted it → UserMetricCreate must also accept the
        # overlapping fields
        metric = UserMetricCreate(
            height_cm=req.height_cm,
            weight_kg=req.weight_kg,
            body_fat_pct=req.body_fat_pct,
            activity_level=req.activity_level,
        )
        assert metric is not None

        # UserGoalSet must also accept the goal fields
        goal = UserGoalSet(
            goal_type=req.goal_type,
            goal_rate_per_week=req.goal_rate_per_week,
        )
        assert goal is not None
