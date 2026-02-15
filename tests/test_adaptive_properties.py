"""Property-based tests for the adaptive engine.

Tests Properties 9 and 29 from the design document using Hypothesis.
"""

from __future__ import annotations

from datetime import date, timedelta

from hypothesis import given, settings as h_settings, strategies as st

from src.modules.adaptive.engine import (
    ADJUSTMENT_CLAMP_MAX,
    ADJUSTMENT_CLAMP_MIN,
    MIN_CARBS_G,
    MIN_TARGET_CALORIES,
    AdaptiveInput,
    compute_snapshot,
)
from src.shared.types import ActivityLevel, GoalType


# ---------------------------------------------------------------------------
# Strategies — smart generators constrained to valid input ranges
# ---------------------------------------------------------------------------

_activity_levels = st.sampled_from(list(ActivityLevel))
_goal_types = st.sampled_from(list(GoalType))
_sexes = st.sampled_from(["male", "female"])


@st.composite
def _bodyweight_histories(draw: st.DrawFn) -> list[tuple[date, float]]:
    """Generate a valid bodyweight history with 3-30 entries.

    Weights are constrained to realistic ranges (30-200 kg) and
    day-over-day changes are kept within ±1.5 kg to avoid having
    all entries filtered out by the extreme-fluctuation filter.
    """
    length = draw(st.integers(min_value=3, max_value=30))
    start_date = draw(
        st.dates(
            min_value=date(2020, 1, 1),
            max_value=date(2025, 1, 1),
        )
    )
    first_weight = draw(st.floats(min_value=30.0, max_value=200.0))

    history: list[tuple[date, float]] = [(start_date, round(first_weight, 1))]
    for i in range(1, length):
        delta = draw(st.floats(min_value=-1.5, max_value=1.5))
        prev_weight = history[-1][1]
        new_weight = max(30.0, min(200.0, prev_weight + delta))
        history.append(
            (start_date + timedelta(days=i), round(new_weight, 1))
        )
    return history


@st.composite
def _adaptive_inputs(draw: st.DrawFn) -> AdaptiveInput:
    """Generate a random valid AdaptiveInput."""
    goal_type = draw(_goal_types)

    # Goal rate should be directionally consistent with goal type
    if goal_type == GoalType.CUTTING:
        goal_rate = draw(st.floats(min_value=-1.0, max_value=-0.1))
    elif goal_type == GoalType.BULKING:
        goal_rate = draw(st.floats(min_value=0.1, max_value=1.0))
    else:
        goal_rate = draw(st.floats(min_value=-0.3, max_value=0.3))

    return AdaptiveInput(
        weight_kg=draw(st.floats(min_value=30.0, max_value=200.0)),
        height_cm=draw(st.floats(min_value=100.0, max_value=250.0)),
        age_years=draw(st.integers(min_value=15, max_value=80)),
        sex=draw(_sexes),
        activity_level=draw(_activity_levels),
        goal_type=goal_type,
        goal_rate_per_week=round(goal_rate, 2),
        bodyweight_history=draw(_bodyweight_histories()),
        training_load_score=draw(
            st.floats(min_value=0.0, max_value=100.0)
        ),
    )


# ---------------------------------------------------------------------------
# Property 9: Adaptive engine determinism
# ---------------------------------------------------------------------------


class TestProperty9Determinism:
    """Property 9: Adaptive engine determinism.

    For any valid AdaptiveInput, calling compute_snapshot twice with
    identical inputs SHALL produce identical AdaptiveOutput values.

    **Validates: Requirements 7.5**
    """

    @h_settings(max_examples=100)
    @given(inp=_adaptive_inputs())
    def test_identical_inputs_produce_identical_outputs(self, inp: AdaptiveInput):
        """compute_snapshot is a pure function — same input, same output.

        **Validates: Requirements 7.5**
        """
        output_a = compute_snapshot(inp)
        output_b = compute_snapshot(inp)

        assert output_a.target_calories == output_b.target_calories
        assert output_a.target_protein_g == output_b.target_protein_g
        assert output_a.target_carbs_g == output_b.target_carbs_g
        assert output_a.target_fat_g == output_b.target_fat_g
        assert output_a.ema_current == output_b.ema_current
        assert output_a.adjustment_factor == output_b.adjustment_factor


# ---------------------------------------------------------------------------
# Property 29: Adaptive engine output safety bounds
# ---------------------------------------------------------------------------


class TestProperty29SafetyBounds:
    """Property 29: Adaptive engine output safety bounds.

    For any valid AdaptiveInput:
    - target_calories >= 1200
    - target_carbs_g >= 50
    - adjustment_factor is clamped to [-300, +300]

    **Validates: Requirements 7.1**
    """

    @h_settings(max_examples=100)
    @given(inp=_adaptive_inputs())
    def test_minimum_calories(self, inp: AdaptiveInput):
        """Target calories must never drop below 1200.

        **Validates: Requirements 7.1**
        """
        output = compute_snapshot(inp)
        assert output.target_calories >= MIN_TARGET_CALORIES, (
            f"target_calories={output.target_calories} < {MIN_TARGET_CALORIES}"
        )

    @h_settings(max_examples=100)
    @given(inp=_adaptive_inputs())
    def test_minimum_carbs(self, inp: AdaptiveInput):
        """Target carbs must never drop below 50g.

        **Validates: Requirements 7.1**
        """
        output = compute_snapshot(inp)
        assert output.target_carbs_g >= MIN_CARBS_G, (
            f"target_carbs_g={output.target_carbs_g} < {MIN_CARBS_G}"
        )

    @h_settings(max_examples=100)
    @given(inp=_adaptive_inputs())
    def test_adjustment_clamped(self, inp: AdaptiveInput):
        """Adjustment factor must be clamped to [-300, +300].

        **Validates: Requirements 7.1**
        """
        output = compute_snapshot(inp)
        assert ADJUSTMENT_CLAMP_MIN <= output.adjustment_factor <= ADJUSTMENT_CLAMP_MAX, (
            f"adjustment_factor={output.adjustment_factor} outside "
            f"[{ADJUSTMENT_CLAMP_MIN}, {ADJUSTMENT_CLAMP_MAX}]"
        )

    @h_settings(max_examples=100)
    @given(inp=_adaptive_inputs())
    def test_all_outputs_positive(self, inp: AdaptiveInput):
        """All macro targets and calories must be positive.

        **Validates: Requirements 7.1**
        """
        output = compute_snapshot(inp)
        assert output.target_calories > 0
        assert output.target_protein_g > 0
        assert output.target_carbs_g > 0
        assert output.target_fat_g > 0
