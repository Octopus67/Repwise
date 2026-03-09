"""Unit tests for combined_score.py — compute_combined_recovery.

Tests edge cases, volume_multiplier bounds, label thresholds, and factor tracking.
"""

from __future__ import annotations

from dataclasses import dataclass

import pytest

from src.modules.readiness.combined_score import (
    CombinedConfig,
    CombinedFactor,
    CombinedRecoveryResult,
    compute_combined_recovery,
)


# ── Helpers ──

@dataclass
class FakeFatigueScore:
    muscle_group: str
    score: float


# ── Tests: Basic behavior ──

class TestBasicCombinedScore:
    def test_both_none_returns_neutral_50(self):
        result = compute_combined_recovery(None, None)
        assert result.score == 50
        assert result.label == "Train Smart"

    def test_both_none_volume_multiplier(self):
        result = compute_combined_recovery(None, None)
        assert result.volume_multiplier == pytest.approx(0.85, abs=0.01)

    def test_readiness_only(self):
        result = compute_combined_recovery(80, None)
        assert result.score == 80
        assert result.label == "Ready to Push"

    def test_fatigue_only(self):
        fatigue = [FakeFatigueScore("chest", 30)]
        result = compute_combined_recovery(None, fatigue)
        # combined = 100 - 30 = 70
        assert result.score == 70
        assert result.label == "Ready to Push"

    def test_both_present(self):
        fatigue = [FakeFatigueScore("chest", 40)]
        result = compute_combined_recovery(80, fatigue)
        # combined = 0.6 * 80 + 0.4 * (100 - 40) = 48 + 24 = 72
        assert result.score == 72
        assert result.label == "Ready to Push"


# ── Tests: Volume multiplier bounds ──

class TestVolumeMultiplierBounds:
    def test_minimum_at_score_0(self):
        result = compute_combined_recovery(0, None)
        assert result.volume_multiplier == 0.5

    def test_maximum_at_score_100(self):
        result = compute_combined_recovery(100, None)
        assert result.volume_multiplier == 1.2

    def test_midpoint_at_score_50(self):
        result = compute_combined_recovery(None, None)  # neutral 50
        assert result.volume_multiplier == pytest.approx(0.85, abs=0.01)

    def test_never_below_0_5(self):
        # Even with extreme fatigue
        fatigue = [FakeFatigueScore("chest", 100), FakeFatigueScore("back", 100)]
        result = compute_combined_recovery(0, fatigue)
        assert result.volume_multiplier >= 0.5

    def test_never_above_1_2(self):
        result = compute_combined_recovery(100, [FakeFatigueScore("chest", 0)])
        assert result.volume_multiplier <= 1.2


# ── Tests: Label thresholds ──

class TestLabelThresholds:
    def test_score_70_ready_to_push(self):
        result = compute_combined_recovery(70, None)
        assert result.label == "Ready to Push"

    def test_score_69_train_smart(self):
        result = compute_combined_recovery(69, None)
        assert result.label == "Train Smart"

    def test_score_40_train_smart(self):
        result = compute_combined_recovery(40, None)
        assert result.label == "Train Smart"

    def test_score_39_recovery_day(self):
        result = compute_combined_recovery(39, None)
        assert result.label == "Recovery Day"

    def test_score_0_recovery_day(self):
        result = compute_combined_recovery(0, None)
        assert result.label == "Recovery Day"

    def test_score_100_ready_to_push(self):
        result = compute_combined_recovery(100, None)
        assert result.label == "Ready to Push"


# ── Tests: Edge cases ──

class TestEdgeCases:
    def test_empty_fatigue_list(self):
        result = compute_combined_recovery(80, [])
        assert result.score == 80

    def test_fatigue_with_none_score_attr(self):
        """Fatigue objects without score attribute are skipped."""
        @dataclass
        class BadFatigue:
            muscle_group: str
        result = compute_combined_recovery(80, [BadFatigue("chest")])
        assert result.score == 80

    def test_multiple_fatigue_scores_averaged(self):
        fatigue = [
            FakeFatigueScore("chest", 20),
            FakeFatigueScore("back", 60),
        ]
        result = compute_combined_recovery(None, fatigue)
        # avg_fatigue = 40, combined = 100 - 40 = 60
        assert result.score == 60

    def test_score_clamped_to_0(self):
        # readiness=0, very high fatigue
        fatigue = [FakeFatigueScore("chest", 100)]
        result = compute_combined_recovery(0, fatigue)
        # 0.6 * 0 + 0.4 * (100 - 100) = 0
        assert result.score == 0
        assert result.score >= 0

    def test_score_clamped_to_100(self):
        result = compute_combined_recovery(100, [FakeFatigueScore("chest", 0)])
        # 0.6 * 100 + 0.4 * 100 = 100
        assert result.score == 100
        assert result.score <= 100


# ── Tests: Custom config ──

class TestCustomConfig:
    def test_custom_readiness_weight(self):
        config = CombinedConfig(readiness_weight=0.8)
        fatigue = [FakeFatigueScore("chest", 50)]
        result = compute_combined_recovery(80, fatigue, config)
        # 0.8 * 80 + 0.2 * (100 - 50) = 64 + 10 = 74
        assert result.score == 74

    def test_zero_readiness_weight_fatigue_only(self):
        config = CombinedConfig(readiness_weight=0.0)
        fatigue = [FakeFatigueScore("chest", 30)]
        result = compute_combined_recovery(80, fatigue, config)
        # 0.0 * 80 + 1.0 * (100 - 30) = 70
        assert result.score == 70

    def test_full_readiness_weight_ignores_fatigue(self):
        config = CombinedConfig(readiness_weight=1.0)
        fatigue = [FakeFatigueScore("chest", 90)]
        result = compute_combined_recovery(80, fatigue, config)
        # 1.0 * 80 + 0.0 * (100 - 90) = 80
        assert result.score == 80


# ── Tests: Factor tracking ──

class TestFactorTracking:
    def test_readiness_factor_included(self):
        result = compute_combined_recovery(80, None)
        readiness_factors = [f for f in result.factors if f.source == "readiness"]
        assert len(readiness_factors) == 1
        assert readiness_factors[0].name == "readiness"
        assert readiness_factors[0].value == 80.0

    def test_fatigue_factors_included(self):
        fatigue = [FakeFatigueScore("chest", 30), FakeFatigueScore("back", 50)]
        result = compute_combined_recovery(None, fatigue)
        fatigue_factors = [f for f in result.factors if f.source == "fatigue"]
        assert len(fatigue_factors) == 2
        assert fatigue_factors[0].name == "chest"
        assert fatigue_factors[1].name == "back"

    def test_no_factors_when_both_none(self):
        result = compute_combined_recovery(None, None)
        assert result.factors == []

    def test_all_factors_present_when_both_provided(self):
        fatigue = [FakeFatigueScore("legs", 40)]
        result = compute_combined_recovery(75, fatigue)
        assert len(result.factors) == 2  # 1 fatigue + 1 readiness


# ── Tests: Result immutability ──

class TestResultImmutability:
    def test_result_is_frozen_dataclass(self):
        result = compute_combined_recovery(80, None)
        with pytest.raises(AttributeError):
            result.score = 99  # type: ignore

    def test_config_is_frozen(self):
        config = CombinedConfig()
        with pytest.raises(AttributeError):
            config.readiness_weight = 0.9  # type: ignore
