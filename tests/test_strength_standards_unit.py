"""Unit tests for strength_standards.py — classification, ranking, edge cases."""

from __future__ import annotations

import pytest
from hypothesis import given, settings as h_settings, strategies as st

from src.modules.training.strength_standards import (
    STRENGTH_STANDARDS,
    SUPPORTED_LIFTS,
    StrengthClassification,
    StrengthLevel,
    classify_strength,
    get_supported_lifts,
    rank_by_strength,
)

_pbt_settings = h_settings(max_examples=100, deadline=None)


class TestClassifyStrength:
    """Core classification logic."""

    def test_beginner_bench(self):
        # 0.5 * 80 = 40 kg threshold; e1rm=40 should be beginner
        c = classify_strength("barbell bench press", 40.0, 80.0)
        assert c.level == StrengthLevel.BEGINNER
        assert c.next_level == StrengthLevel.INTERMEDIATE
        assert c.next_level_threshold_kg == 80.0  # 1.0 * 80

    def test_intermediate_squat(self):
        # 1.25 * 80 = 100; e1rm=100 should be intermediate
        c = classify_strength("barbell back squat", 100.0, 80.0)
        assert c.level == StrengthLevel.INTERMEDIATE

    def test_advanced_deadlift(self):
        # 2.0 * 80 = 160; e1rm=160 should be advanced
        c = classify_strength("conventional deadlift", 160.0, 80.0)
        assert c.level == StrengthLevel.ADVANCED

    def test_elite_overhead_press(self):
        # 1.4 * 80 = 112; e1rm=112 should be elite
        c = classify_strength("overhead press", 112.0, 80.0)
        assert c.level == StrengthLevel.ELITE
        assert c.next_level is None
        assert c.next_level_threshold_kg is None

    def test_below_beginner(self):
        # ratio = 10/80 = 0.125, below beginner threshold 0.5
        c = classify_strength("barbell bench press", 10.0, 80.0)
        assert c.level == StrengthLevel.UNKNOWN
        assert c.next_level == StrengthLevel.BEGINNER
        assert c.next_level_threshold_kg == 40.0  # 0.5 * 80

    def test_case_insensitive(self):
        c = classify_strength("  Barbell Bench Press  ", 40.0, 80.0)
        assert c.level == StrengthLevel.BEGINNER
        assert c.exercise_name == "barbell bench press"

    def test_all_supported_lifts_classifiable(self):
        for lift in SUPPORTED_LIFTS:
            c = classify_strength(lift, 100.0, 80.0)
            assert isinstance(c, StrengthClassification)

    def test_boundary_exactly_at_threshold(self):
        # Exactly at intermediate threshold: 1.0 * 80 = 80
        c = classify_strength("barbell bench press", 80.0, 80.0)
        assert c.level == StrengthLevel.INTERMEDIATE

    def test_just_below_threshold(self):
        # Just below intermediate: ratio = 79.99/80 = 0.999875 < 1.0
        c = classify_strength("barbell bench press", 79.99, 80.0)
        assert c.level == StrengthLevel.BEGINNER


class TestInputValidation:
    """Validation of bad inputs."""

    def test_unknown_exercise_raises(self):
        with pytest.raises(ValueError, match="Unsupported exercise"):
            classify_strength("bicep curl", 50.0, 80.0)

    def test_empty_exercise_raises(self):
        with pytest.raises(ValueError, match="Unsupported exercise"):
            classify_strength("", 50.0, 80.0)

    def test_negative_e1rm_raises(self):
        with pytest.raises(ValueError, match="e1rm_kg must be >= 0"):
            classify_strength("barbell bench press", -10.0, 80.0)

    def test_negative_bodyweight_raises(self):
        with pytest.raises(ValueError, match="bodyweight_kg must be >= 0"):
            classify_strength("barbell bench press", 100.0, -80.0)

    def test_zero_bodyweight_returns_unknown(self):
        c = classify_strength("barbell bench press", 100.0, 0.0)
        assert c.level == StrengthLevel.UNKNOWN
        assert c.bodyweight_ratio == 0.0

    def test_zero_e1rm_returns_unknown(self):
        c = classify_strength("barbell bench press", 0.0, 80.0)
        assert c.level == StrengthLevel.UNKNOWN
        assert c.bodyweight_ratio == 0.0


class TestRankByStrength:
    """Ranking classifications."""

    def test_ranking_order(self):
        c1 = classify_strength("barbell bench press", 160.0, 80.0)  # ratio 2.0
        c2 = classify_strength("overhead press", 40.0, 80.0)        # ratio 0.5
        c3 = classify_strength("conventional deadlift", 200.0, 80.0) # ratio 2.5
        ranked = rank_by_strength([c1, c2, c3])
        assert ranked[0].bodyweight_ratio >= ranked[1].bodyweight_ratio
        assert ranked[1].bodyweight_ratio >= ranked[2].bodyweight_ratio

    def test_ranking_empty(self):
        assert rank_by_strength([]) == []


class TestGetSupportedLifts:
    """Supported lifts list."""

    def test_returns_five_lifts(self):
        lifts = get_supported_lifts()
        assert len(lifts) == 5

    def test_all_lifts_in_standards(self):
        for lift in get_supported_lifts():
            assert lift in STRENGTH_STANDARDS


class TestPropertyBasedClassification:
    """Property-based tests for classification invariants."""

    @_pbt_settings
    @given(
        e1rm=st.floats(min_value=0.0, max_value=500.0, allow_nan=False, allow_infinity=False),
        bw=st.floats(min_value=30.0, max_value=200.0, allow_nan=False, allow_infinity=False),
        lift=st.sampled_from(SUPPORTED_LIFTS),
    )
    def test_level_is_valid_enum(self, e1rm: float, bw: float, lift: str):
        c = classify_strength(lift, e1rm, bw)
        assert c.level in StrengthLevel

    @_pbt_settings
    @given(
        e1rm=st.floats(min_value=0.0, max_value=500.0, allow_nan=False, allow_infinity=False),
        bw=st.floats(min_value=30.0, max_value=200.0, allow_nan=False, allow_infinity=False),
        lift=st.sampled_from(SUPPORTED_LIFTS),
    )
    def test_ratio_is_non_negative(self, e1rm: float, bw: float, lift: str):
        c = classify_strength(lift, e1rm, bw)
        assert c.bodyweight_ratio >= 0.0

    @_pbt_settings
    @given(
        e1rm=st.floats(min_value=0.0, max_value=500.0, allow_nan=False, allow_infinity=False),
        bw=st.floats(min_value=30.0, max_value=200.0, allow_nan=False, allow_infinity=False),
        lift=st.sampled_from(SUPPORTED_LIFTS),
    )
    def test_elite_has_no_next_level(self, e1rm: float, bw: float, lift: str):
        c = classify_strength(lift, e1rm, bw)
        if c.level == StrengthLevel.ELITE:
            assert c.next_level is None
            assert c.next_level_threshold_kg is None

    @_pbt_settings
    @given(
        e1rm=st.floats(min_value=0.0, max_value=500.0, allow_nan=False, allow_infinity=False),
        bw=st.floats(min_value=30.0, max_value=200.0, allow_nan=False, allow_infinity=False),
        lift=st.sampled_from(SUPPORTED_LIFTS),
    )
    def test_non_elite_has_next_level(self, e1rm: float, bw: float, lift: str):
        c = classify_strength(lift, e1rm, bw)
        if c.level != StrengthLevel.ELITE:
            assert c.next_level is not None
            assert c.next_level_threshold_kg is not None
            assert c.next_level_threshold_kg > 0
