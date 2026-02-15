"""Unit tests for volume_service pure computation functions.

Tests compute_effort, classify_status, validate_week_start, _safe_float, _safe_int.
"""

from __future__ import annotations

from datetime import date

import pytest

from src.modules.training.volume_service import (
    classify_status,
    compute_effort,
    validate_week_start,
    _safe_float,
    _safe_int,
)


# ─── compute_effort ──────────────────────────────────────────────────────────


class TestComputeEffort:
    """Tests for the RPE → effort multiplier mapping."""

    def test_none_rpe_returns_full_effort(self):
        assert compute_effort(None) == 1.0

    def test_rpe_10_returns_full_effort(self):
        assert compute_effort(10.0) == 1.0

    def test_rpe_9_returns_full_effort(self):
        assert compute_effort(9.0) == 1.0

    def test_rpe_8_returns_full_effort(self):
        assert compute_effort(8.0) == 1.0

    def test_rpe_7_returns_moderate_effort(self):
        assert compute_effort(7.0) == 0.75

    def test_rpe_6_returns_moderate_effort(self):
        assert compute_effort(6.0) == 0.75

    def test_rpe_5_returns_low_effort(self):
        assert compute_effort(5.0) == 0.5

    def test_rpe_1_returns_low_effort(self):
        assert compute_effort(1.0) == 0.5

    def test_rpe_boundary_7_99(self):
        assert compute_effort(7.99) == 0.75

    def test_rpe_boundary_5_99(self):
        assert compute_effort(5.99) == 0.5

    # Edge cases: out-of-range RPE values are clamped
    def test_rpe_zero_clamped_to_1(self):
        """RPE 0 is clamped to 1.0 (below 6 → 0.5)."""
        assert compute_effort(0.0) == 0.5

    def test_rpe_negative_clamped(self):
        """Negative RPE is clamped to 1.0 (below 6 → 0.5)."""
        assert compute_effort(-5.0) == 0.5

    def test_rpe_above_10_clamped(self):
        """RPE > 10 is clamped to 10 (>= 8 → 1.0)."""
        assert compute_effort(15.0) == 1.0

    def test_rpe_very_large_clamped(self):
        assert compute_effort(99999.0) == 1.0


# ─── classify_status ─────────────────────────────────────────────────────────


class TestClassifyStatus:
    """Tests for volume status classification."""

    def test_below_mev(self):
        assert classify_status(5.0, mev=10, mav=16, mrv=22) == "below_mev"

    def test_exactly_at_mev(self):
        assert classify_status(10.0, mev=10, mav=16, mrv=22) == "optimal"

    def test_between_mev_and_mav(self):
        assert classify_status(13.0, mev=10, mav=16, mrv=22) == "optimal"

    def test_exactly_at_mav(self):
        assert classify_status(16.0, mev=10, mav=16, mrv=22) == "optimal"

    def test_between_mav_and_mrv(self):
        assert classify_status(19.0, mev=10, mav=16, mrv=22) == "approaching_mrv"

    def test_exactly_at_mrv(self):
        assert classify_status(22.0, mev=10, mav=16, mrv=22) == "approaching_mrv"

    def test_above_mrv(self):
        assert classify_status(25.0, mev=10, mav=16, mrv=22) == "above_mrv"

    def test_zero_sets(self):
        assert classify_status(0.0, mev=10, mav=16, mrv=22) == "below_mev"

    def test_zero_landmarks(self):
        """When all landmarks are 0, any positive volume is above MRV."""
        assert classify_status(1.0, mev=0, mav=0, mrv=0) == "above_mrv"

    def test_zero_sets_zero_landmarks(self):
        """0 sets with 0 MEV → optimal (0 <= 0)."""
        assert classify_status(0.0, mev=0, mav=0, mrv=0) == "optimal"

    def test_very_large_volume(self):
        assert classify_status(999.0, mev=10, mav=16, mrv=22) == "above_mrv"

    def test_fractional_sets(self):
        """Fractional effective sets (e.g. from 0.75 effort) are handled."""
        assert classify_status(9.75, mev=10, mav=16, mrv=22) == "below_mev"
        assert classify_status(10.25, mev=10, mav=16, mrv=22) == "optimal"


# ─── validate_week_start ─────────────────────────────────────────────────────


class TestValidateWeekStart:
    """Tests for Monday validation."""

    def test_monday_passes(self):
        monday = date(2024, 1, 8)  # Known Monday
        assert validate_week_start(monday) == monday

    def test_tuesday_raises(self):
        tuesday = date(2024, 1, 9)
        with pytest.raises(ValueError, match="Monday"):
            validate_week_start(tuesday)

    def test_sunday_raises(self):
        sunday = date(2024, 1, 7)
        with pytest.raises(ValueError, match="Monday"):
            validate_week_start(sunday)

    def test_saturday_raises(self):
        saturday = date(2024, 1, 6)
        with pytest.raises(ValueError, match="Monday"):
            validate_week_start(saturday)


# ─── _safe_float ─────────────────────────────────────────────────────────────


class TestSafeFloat:
    """Tests for the safe float conversion helper."""

    def test_valid_float(self):
        assert _safe_float(3.14) == 3.14

    def test_valid_int(self):
        assert _safe_float(5) == 5.0

    def test_valid_string(self):
        assert _safe_float("2.5") == 2.5

    def test_none_returns_default(self):
        assert _safe_float(None) == 0.0

    def test_empty_string_returns_default(self):
        assert _safe_float("") == 0.0

    def test_non_numeric_string_returns_default(self):
        assert _safe_float("abc") == 0.0

    def test_inf_returns_default(self):
        assert _safe_float(float("inf")) == 0.0

    def test_nan_returns_default(self):
        assert _safe_float(float("nan")) == 0.0

    def test_negative_inf_returns_default(self):
        assert _safe_float(float("-inf")) == 0.0

    def test_custom_default(self):
        assert _safe_float("bad", default=-1.0) == -1.0


# ─── _safe_int ───────────────────────────────────────────────────────────────


class TestSafeInt:
    """Tests for the safe int conversion helper."""

    def test_valid_int(self):
        assert _safe_int(42) == 42

    def test_valid_float_truncates(self):
        assert _safe_int(3.9) == 3

    def test_valid_string(self):
        assert _safe_int("7") == 7

    def test_none_returns_default(self):
        assert _safe_int(None) == 0

    def test_empty_string_returns_default(self):
        assert _safe_int("") == 0

    def test_non_numeric_string_returns_default(self):
        assert _safe_int("xyz") == 0

    def test_custom_default(self):
        assert _safe_int("bad", default=-1) == -1


# ─── Schema Validation ───────────────────────────────────────────────────────


class TestSchemaValidation:
    """Tests that Pydantic schemas enforce bounds correctly."""

    def test_set_detail_rejects_negative_weight(self):
        from src.modules.training.volume_schemas import SetDetail

        with pytest.raises(Exception):
            SetDetail(weight_kg=-1.0, reps=10, effort=0.5)

    def test_set_detail_rejects_excessive_weight(self):
        from src.modules.training.volume_schemas import SetDetail

        with pytest.raises(Exception):
            SetDetail(weight_kg=2000.0, reps=10, effort=0.5)

    def test_set_detail_rejects_negative_reps(self):
        from src.modules.training.volume_schemas import SetDetail

        with pytest.raises(Exception):
            SetDetail(weight_kg=100.0, reps=-5, effort=0.5)

    def test_set_detail_rejects_excessive_reps(self):
        from src.modules.training.volume_schemas import SetDetail

        with pytest.raises(Exception):
            SetDetail(weight_kg=100.0, reps=1000, effort=0.5)

    def test_set_detail_rejects_rpe_out_of_range(self):
        from src.modules.training.volume_schemas import SetDetail

        with pytest.raises(Exception):
            SetDetail(weight_kg=100.0, reps=10, rpe=0.0, effort=0.5)
        with pytest.raises(Exception):
            SetDetail(weight_kg=100.0, reps=10, rpe=11.0, effort=0.5)

    def test_set_detail_rejects_effort_above_1(self):
        from src.modules.training.volume_schemas import SetDetail

        with pytest.raises(Exception):
            SetDetail(weight_kg=100.0, reps=10, effort=1.5)

    def test_set_detail_accepts_valid_data(self):
        from src.modules.training.volume_schemas import SetDetail

        sd = SetDetail(weight_kg=100.0, reps=10, rpe=8.0, effort=1.0)
        assert sd.weight_kg == 100.0
        assert sd.reps == 10
        assert sd.rpe == 8.0
        assert sd.effort == 1.0

    def test_landmark_update_rejects_invalid_ordering(self):
        from src.modules.training.volume_schemas import LandmarkUpdateRequest

        with pytest.raises(Exception):
            LandmarkUpdateRequest(muscle_group="chest", mev=20, mav=15, mrv=10)

    def test_landmark_update_rejects_equal_values(self):
        from src.modules.training.volume_schemas import LandmarkUpdateRequest

        with pytest.raises(Exception):
            LandmarkUpdateRequest(muscle_group="chest", mev=10, mav=10, mrv=10)

    def test_landmark_update_accepts_valid_ordering(self):
        from src.modules.training.volume_schemas import LandmarkUpdateRequest

        req = LandmarkUpdateRequest(muscle_group="chest", mev=10, mav=16, mrv=22)
        assert req.mev == 10
        assert req.mav == 16
        assert req.mrv == 22

    def test_landmark_update_rejects_excessive_values(self):
        from src.modules.training.volume_schemas import LandmarkUpdateRequest

        with pytest.raises(Exception):
            LandmarkUpdateRequest(muscle_group="chest", mev=10, mav=16, mrv=100000)

    def test_muscle_group_volume_rejects_invalid_status(self):
        from src.modules.training.volume_schemas import MuscleGroupVolume

        with pytest.raises(Exception):
            MuscleGroupVolume(
                muscle_group="chest",
                effective_sets=10.0,
                frequency=3,
                volume_status="invalid_status",
                mev=10,
                mav=16,
                mrv=22,
            )

    def test_muscle_group_volume_accepts_valid_status(self):
        from src.modules.training.volume_schemas import MuscleGroupVolume

        for status in ("below_mev", "optimal", "approaching_mrv", "above_mrv"):
            vol = MuscleGroupVolume(
                muscle_group="chest",
                effective_sets=10.0,
                frequency=3,
                volume_status=status,
                mev=10,
                mav=16,
                mrv=22,
            )
            assert vol.volume_status == status
