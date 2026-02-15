"""Property-based tests for Strength Standards and Milestones.

Tests Properties 5–9 from the Strength Standards design document using
Hypothesis, exercised against pure functions with no database dependencies.
"""

from __future__ import annotations

import pytest
from hypothesis import given, settings as h_settings, strategies as st

from src.modules.training.milestone_generator import Milestone, generate_milestones
from src.modules.training.strength_standards import (
    STRENGTH_STANDARDS,
    SUPPORTED_LIFTS,
    StrengthClassification,
    StrengthLevel,
    classify_strength,
    rank_by_strength,
)

_pbt_settings = h_settings(max_examples=100, deadline=None)

_supported_lift_st = st.sampled_from(SUPPORTED_LIFTS)
_e1rm_st = st.floats(min_value=1.0, max_value=500.0, allow_nan=False, allow_infinity=False)
_bw_st = st.floats(min_value=30.0, max_value=200.0, allow_nan=False, allow_infinity=False)

_ORDERED_LEVELS = [
    StrengthLevel.BEGINNER,
    StrengthLevel.INTERMEDIATE,
    StrengthLevel.ADVANCED,
    StrengthLevel.ELITE,
]


class TestProperty5DataCompleteness:
    """Property 5: Strength Standards Data Completeness.

    For any exercise in SUPPORTED_LIFTS, all four levels exist with
    strictly ascending thresholds.

    Validates: Requirements 3.1
    """

    @_pbt_settings
    @given(exercise=_supported_lift_st)
    def test_all_levels_present_and_ascending(self, exercise: str):
        thresholds = STRENGTH_STANDARDS[exercise]
        for level in _ORDERED_LEVELS:
            assert level in thresholds

        values = [thresholds[l] for l in _ORDERED_LEVELS]
        for i in range(len(values) - 1):
            assert values[i] < values[i + 1], f"{exercise}: thresholds not ascending"


class TestProperty6ClassificationCorrectness:
    """Property 6: Strength Classification Correctness.

    For any supported exercise, e1rm > 0, bodyweight > 0, returned level's
    threshold is met and next level's threshold is not.

    Validates: Requirements 3.2
    """

    @_pbt_settings
    @given(exercise=_supported_lift_st, e1rm=_e1rm_st, bw=_bw_st)
    def test_classification_boundaries(self, exercise: str, e1rm: float, bw: float):
        c = classify_strength(exercise, e1rm, bw)
        ratio = e1rm / bw
        thresholds = STRENGTH_STANDARDS[exercise]

        if c.level == StrengthLevel.UNKNOWN:
            # Below beginner
            assert ratio < thresholds[StrengthLevel.BEGINNER]
        elif c.level == StrengthLevel.ELITE:
            assert ratio >= thresholds[StrengthLevel.ELITE]
        else:
            assert ratio >= thresholds[c.level]
            idx = _ORDERED_LEVELS.index(c.level)
            next_level = _ORDERED_LEVELS[idx + 1]
            assert ratio < thresholds[next_level]


class TestProperty7MilestoneDeficit:
    """Property 7: Milestone Deficit and Message Correctness.

    For any non-elite classification, deficit_kg equals expected value and
    message contains exercise name, next level, and deficit.

    Validates: Requirements 4.1, 4.2
    """

    @_pbt_settings
    @given(exercise=_supported_lift_st, e1rm=_e1rm_st, bw=_bw_st)
    def test_deficit_and_message(self, exercise: str, e1rm: float, bw: float):
        c = classify_strength(exercise, e1rm, bw)
        if c.level in (StrengthLevel.UNKNOWN, StrengthLevel.ELITE):
            return  # Skip — unknown omitted, elite tested separately

        milestones = generate_milestones([c])
        assert len(milestones) == 1
        m = milestones[0]

        expected_deficit = max(c.next_level_threshold_kg - e1rm, 0.0)
        assert m.deficit_kg == pytest.approx(round(expected_deficit, 2), abs=0.01)
        assert c.exercise_name in m.message
        assert c.next_level.value in m.message


class TestProperty8MilestoneSorting:
    """Property 8: Milestone Sorting by Deficit.

    For any list of milestones, deficit_kg values are non-decreasing.

    Validates: Requirements 4.5
    """

    @_pbt_settings
    @given(
        classifications=st.lists(
            st.tuples(_supported_lift_st, _e1rm_st, _bw_st),
            min_size=1,
            max_size=5,
            unique_by=lambda t: t[0],
        )
    )
    def test_milestones_sorted_by_deficit(self, classifications):
        cs = [classify_strength(ex, e1rm, bw) for ex, e1rm, bw in classifications]
        milestones = generate_milestones(cs)
        for i in range(len(milestones) - 1):
            assert milestones[i].deficit_kg <= milestones[i + 1].deficit_kg


class TestProperty9LeaderboardSorting:
    """Property 9: Leaderboard Sorting by Bodyweight Ratio.

    For any list of classifications, rank_by_strength returns
    non-increasing bodyweight_ratio order.

    Validates: Requirements 5.1
    """

    @_pbt_settings
    @given(
        classifications=st.lists(
            st.tuples(_supported_lift_st, _e1rm_st, _bw_st),
            min_size=1,
            max_size=5,
            unique_by=lambda t: t[0],
        )
    )
    def test_ranked_by_ratio_descending(self, classifications):
        cs = [classify_strength(ex, e1rm, bw) for ex, e1rm, bw in classifications]
        ranked = rank_by_strength(cs)
        for i in range(len(ranked) - 1):
            assert ranked[i].bodyweight_ratio >= ranked[i + 1].bodyweight_ratio


class TestEdgeCases:
    """Edge case unit tests for strength standards."""

    def test_exactly_at_beginner_threshold(self):
        bw = 80.0
        # Bench beginner threshold is 0.5 → e1rm = 40.0
        c = classify_strength("barbell bench press", 40.0, bw)
        assert c.level == StrengthLevel.BEGINNER

    def test_exactly_at_elite_threshold(self):
        bw = 80.0
        # Bench elite threshold is 2.0 → e1rm = 160.0
        c = classify_strength("barbell bench press", 160.0, bw)
        assert c.level == StrengthLevel.ELITE
        assert c.next_level is None

    def test_unsupported_exercise_raises(self):
        with pytest.raises(ValueError, match="Unsupported exercise"):
            classify_strength("bicep curl", 50.0, 80.0)

    def test_elite_milestone_congratulatory(self):
        bw = 80.0
        c = classify_strength("barbell bench press", 200.0, bw)
        milestones = generate_milestones([c])
        assert len(milestones) == 1
        assert milestones[0].deficit_kg == 0.0
        assert "Elite" in milestones[0].message

    def test_unknown_level_omitted_from_milestones(self):
        c = StrengthClassification(
            exercise_name="barbell bench press",
            e1rm_kg=10.0,
            bodyweight_kg=80.0,
            bodyweight_ratio=0.125,
            level=StrengthLevel.UNKNOWN,
            next_level=StrengthLevel.BEGINNER,
            next_level_threshold_kg=40.0,
        )
        milestones = generate_milestones([c])
        assert len(milestones) == 0
