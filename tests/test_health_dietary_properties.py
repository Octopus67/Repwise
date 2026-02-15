"""Property-based tests for health reports and dietary analysis modules.

Tests Properties 12, 13, 14, and 27 from the design document using Hypothesis.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st

from src.modules.health_reports.schemas import MarkerRange, MarkerResult
from src.modules.health_reports.service import flag_markers
from src.modules.dietary_analysis.service import (
    DailyAverages,
    NutritionEntryData,
    NutritionGap,
    RecommendedIntake,
    compute_daily_averages,
    detect_gaps,
)


# ---------------------------------------------------------------------------
# Shared Hypothesis settings
# ---------------------------------------------------------------------------

_fixture_settings = h_settings(
    max_examples=100,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)

_db_fixture_settings = h_settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_positive_float = st.floats(min_value=0.01, max_value=10000.0, allow_nan=False, allow_infinity=False)
_reasonable_float = st.floats(min_value=0.0, max_value=5000.0, allow_nan=False, allow_infinity=False)

_marker_names = st.sampled_from([
    "total_cholesterol", "ldl", "hdl", "triglycerides",
    "hemoglobin", "vitamin_d", "vitamin_b12", "iron",
])

_entry_dates = st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 12, 31))


def _marker_range_strategy():
    """Generate a valid MarkerRange where min_normal < max_normal."""
    return st.tuples(
        _positive_float, _positive_float
    ).filter(
        lambda t: t[0] < t[1]
    ).map(
        lambda t: MarkerRange(min_normal=t[0], max_normal=t[1], unit="unit")
    )


def _marker_value_and_range():
    """Generate a marker value and its reference range."""
    return st.tuples(
        _positive_float,
        _marker_range_strategy(),
    )


# ---------------------------------------------------------------------------
# Property 12: Health marker flagging correctness
# ---------------------------------------------------------------------------


class TestProperty12HealthMarkerFlagging:
    """Property 12: Health marker flagging correctness.

    For any health marker value and its corresponding reference range
    (min_normal, max_normal), flag_markers SHALL classify the marker as
    'low' if value < min_normal, 'high' if value > max_normal, and
    'normal' if min_normal <= value <= max_normal.

    **Validates: Requirements 8.2**
    """

    @_fixture_settings
    @given(
        marker_name=_marker_names,
        data=_marker_value_and_range(),
    )
    def test_marker_classification_correctness(
        self,
        marker_name: str,
        data: tuple[float, MarkerRange],
    ):
        """Each marker must be classified correctly against its reference range.

        **Validates: Requirements 8.2**
        """
        value, ref_range = data
        markers = {marker_name: value}
        ranges = {marker_name: ref_range}

        result = flag_markers(markers, ranges)

        assert marker_name in result
        marker_result = result[marker_name]
        assert marker_result.value == value
        assert marker_result.min_normal == ref_range.min_normal
        assert marker_result.max_normal == ref_range.max_normal

        if value < ref_range.min_normal:
            assert marker_result.status == "low", (
                f"Value {value} < min {ref_range.min_normal} should be 'low', "
                f"got '{marker_result.status}'"
            )
        elif value > ref_range.max_normal:
            assert marker_result.status == "high", (
                f"Value {value} > max {ref_range.max_normal} should be 'high', "
                f"got '{marker_result.status}'"
            )
        else:
            assert marker_result.status == "normal", (
                f"Value {value} in [{ref_range.min_normal}, {ref_range.max_normal}] "
                f"should be 'normal', got '{marker_result.status}'"
            )

    @_fixture_settings
    @given(
        markers=st.dictionaries(
            keys=_marker_names,
            values=_positive_float,
            min_size=1,
            max_size=8,
        ),
        ranges=st.dictionaries(
            keys=_marker_names,
            values=_marker_range_strategy(),
            min_size=1,
            max_size=8,
        ),
    )
    def test_only_markers_with_ranges_are_flagged(
        self,
        markers: dict[str, float],
        ranges: dict[str, MarkerRange],
    ):
        """Markers without a matching reference range must be skipped.

        **Validates: Requirements 8.2**
        """
        result = flag_markers(markers, ranges)

        # Every result key must exist in both markers and ranges
        for key in result:
            assert key in markers
            assert key in ranges

        # Every marker that has a range must be in the result
        for key in markers:
            if key in ranges:
                assert key in result


# ---------------------------------------------------------------------------
# Property 13: Dietary analysis average computation
# ---------------------------------------------------------------------------


class TestProperty13DietaryAverages:
    """Property 13: Dietary analysis average computation.

    For any set of nutrition entries over N distinct days,
    compute_daily_averages SHALL return the sum of all entries' values
    divided by N for each nutrient.

    **Validates: Requirements 9.2**
    """

    @_fixture_settings
    @given(
        entries=st.lists(
            st.builds(
                NutritionEntryData,
                entry_date=_entry_dates,
                calories=_reasonable_float,
                protein_g=_reasonable_float,
                carbs_g=_reasonable_float,
                fat_g=_reasonable_float,
                micro_nutrients=st.just(None),
            ),
            min_size=1,
            max_size=30,
        ),
        num_days=st.integers(min_value=1, max_value=30),
    )
    def test_averages_equal_sum_divided_by_days(
        self,
        entries: list[NutritionEntryData],
        num_days: int,
    ):
        """Averages must equal sum of all entries divided by num_days.

        **Validates: Requirements 9.2**
        """
        result = compute_daily_averages(entries, num_days)

        expected_cal = sum(e.calories for e in entries) / num_days
        expected_protein = sum(e.protein_g for e in entries) / num_days
        expected_carbs = sum(e.carbs_g for e in entries) / num_days
        expected_fat = sum(e.fat_g for e in entries) / num_days

        assert result.calories == pytest.approx(expected_cal, rel=1e-6)
        assert result.protein_g == pytest.approx(expected_protein, rel=1e-6)
        assert result.carbs_g == pytest.approx(expected_carbs, rel=1e-6)
        assert result.fat_g == pytest.approx(expected_fat, rel=1e-6)
        assert result.num_days == num_days

    @_fixture_settings
    @given(
        entries=st.lists(
            st.builds(
                NutritionEntryData,
                entry_date=_entry_dates,
                calories=_reasonable_float,
                protein_g=_reasonable_float,
                carbs_g=_reasonable_float,
                fat_g=_reasonable_float,
                micro_nutrients=st.dictionaries(
                    keys=st.sampled_from(["iron", "calcium", "vitamin_d"]),
                    values=_reasonable_float,
                    min_size=0,
                    max_size=3,
                ),
            ),
            min_size=1,
            max_size=15,
        ),
        num_days=st.integers(min_value=1, max_value=30),
    )
    def test_micro_nutrient_averages(
        self,
        entries: list[NutritionEntryData],
        num_days: int,
    ):
        """Micro-nutrient averages must also equal sum / num_days.

        **Validates: Requirements 9.2**
        """
        result = compute_daily_averages(entries, num_days)

        # Compute expected micro totals
        expected_micros: dict[str, float] = {}
        for entry in entries:
            if entry.micro_nutrients:
                for k, v in entry.micro_nutrients.items():
                    expected_micros[k] = expected_micros.get(k, 0.0) + v

        for k, total in expected_micros.items():
            expected_avg = total / num_days
            assert result.micro_nutrients.get(k, 0.0) == pytest.approx(
                expected_avg, rel=1e-6
            ), f"Micro-nutrient '{k}' average mismatch"

    def test_zero_days_returns_zero_averages(self):
        """Zero num_days should return zero averages.

        **Validates: Requirements 9.2**
        """
        entries = [
            NutritionEntryData(
                entry_date=date(2024, 1, 1),
                calories=100.0,
                protein_g=10.0,
                carbs_g=20.0,
                fat_g=5.0,
            )
        ]
        result = compute_daily_averages(entries, 0)
        assert result.calories == 0.0
        assert result.num_days == 0


# ---------------------------------------------------------------------------
# Property 14: Nutritional gap detection
# ---------------------------------------------------------------------------


class TestProperty14NutritionalGapDetection:
    """Property 14: Nutritional gap detection.

    For any nutrient where the computed average daily intake is strictly
    below the recommended daily value, detect_gaps SHALL include it in
    the gaps list with deficit_percentage = (recommended - average) /
    recommended × 100. Nutrients at or above the recommended value SHALL
    NOT appear in the gaps list.

    **Validates: Requirements 9.3**
    """

    @_fixture_settings
    @given(
        avg_cal=_reasonable_float,
        avg_protein=_reasonable_float,
        avg_carbs=_reasonable_float,
        avg_fat=_reasonable_float,
        rec_cal=st.floats(min_value=0.01, max_value=5000.0, allow_nan=False, allow_infinity=False),
        rec_protein=st.floats(min_value=0.01, max_value=500.0, allow_nan=False, allow_infinity=False),
        rec_carbs=st.floats(min_value=0.01, max_value=500.0, allow_nan=False, allow_infinity=False),
        rec_fat=st.floats(min_value=0.01, max_value=500.0, allow_nan=False, allow_infinity=False),
    )
    def test_gaps_detected_for_below_recommended(
        self,
        avg_cal: float,
        avg_protein: float,
        avg_carbs: float,
        avg_fat: float,
        rec_cal: float,
        rec_protein: float,
        rec_carbs: float,
        rec_fat: float,
    ):
        """Nutrients below recommended must appear as gaps with correct deficit %.

        **Validates: Requirements 9.3**
        """
        averages = DailyAverages(
            calories=avg_cal,
            protein_g=avg_protein,
            carbs_g=avg_carbs,
            fat_g=avg_fat,
            num_days=7,
        )
        recommended = RecommendedIntake(
            calories=rec_cal,
            protein_g=rec_protein,
            carbs_g=rec_carbs,
            fat_g=rec_fat,
        )

        gaps = detect_gaps(averages, recommended)
        gap_nutrients = {g.nutrient for g in gaps}

        # Check each macro
        checks = [
            ("calories", avg_cal, rec_cal),
            ("protein_g", avg_protein, rec_protein),
            ("carbs_g", avg_carbs, rec_carbs),
            ("fat_g", avg_fat, rec_fat),
        ]

        for nutrient, avg, rec in checks:
            if avg < rec:
                assert nutrient in gap_nutrients, (
                    f"{nutrient}: avg {avg} < rec {rec} should be a gap"
                )
                gap = next(g for g in gaps if g.nutrient == nutrient)
                expected_deficit = (rec - avg) / rec * 100
                assert gap.deficit_percentage == pytest.approx(expected_deficit, rel=1e-6), (
                    f"{nutrient}: deficit should be {expected_deficit}, got {gap.deficit_percentage}"
                )
                assert gap.average_intake == pytest.approx(avg)
                assert gap.recommended_value == pytest.approx(rec)
            else:
                assert nutrient not in gap_nutrients, (
                    f"{nutrient}: avg {avg} >= rec {rec} should NOT be a gap"
                )

    @_fixture_settings
    @given(
        micro_avgs=st.dictionaries(
            keys=st.sampled_from(["iron", "calcium", "vitamin_d"]),
            values=_reasonable_float,
            min_size=1,
            max_size=3,
        ),
        micro_recs=st.dictionaries(
            keys=st.sampled_from(["iron", "calcium", "vitamin_d"]),
            values=st.floats(min_value=0.01, max_value=500.0, allow_nan=False, allow_infinity=False),
            min_size=1,
            max_size=3,
        ),
    )
    def test_micro_nutrient_gaps(
        self,
        micro_avgs: dict[str, float],
        micro_recs: dict[str, float],
    ):
        """Micro-nutrient gaps must also be correctly detected.

        **Validates: Requirements 9.3**
        """
        # Use high macro values so they don't create gaps
        averages = DailyAverages(
            calories=9999.0,
            protein_g=9999.0,
            carbs_g=9999.0,
            fat_g=9999.0,
            micro_nutrients=micro_avgs,
            num_days=7,
        )
        recommended = RecommendedIntake(
            calories=1.0,
            protein_g=1.0,
            carbs_g=1.0,
            fat_g=1.0,
            micro_nutrients=micro_recs,
        )

        gaps = detect_gaps(averages, recommended)
        gap_nutrients = {g.nutrient for g in gaps}

        for nutrient, rec_val in micro_recs.items():
            avg_val = micro_avgs.get(nutrient, 0.0)
            if avg_val < rec_val:
                assert nutrient in gap_nutrients, (
                    f"Micro {nutrient}: avg {avg_val} < rec {rec_val} should be a gap"
                )
                gap = next(g for g in gaps if g.nutrient == nutrient)
                expected_deficit = (rec_val - avg_val) / rec_val * 100
                assert gap.deficit_percentage == pytest.approx(expected_deficit, rel=1e-6)
            else:
                assert nutrient not in gap_nutrients, (
                    f"Micro {nutrient}: avg {avg_val} >= rec {rec_val} should NOT be a gap"
                )


# ---------------------------------------------------------------------------
# Property 27: Health report chronological ordering
# ---------------------------------------------------------------------------


class TestProperty27ChronologicalOrdering:
    """Property 27: Health report chronological ordering.

    For any user's health report history query, the returned reports
    SHALL be sorted by report_date in ascending chronological order.

    **Validates: Requirements 8.4**
    """

    @pytest.mark.asyncio
    @_db_fixture_settings
    @given(
        report_dates=st.lists(
            _entry_dates,
            min_size=2,
            max_size=10,
        ),
    )
    async def test_reports_returned_in_chronological_order(
        self,
        report_dates: list[date],
        db_session,
    ):
        """Reports must be returned sorted by report_date ascending.

        **Validates: Requirements 8.4**
        """
        from src.modules.health_reports.service import HealthReportService
        from src.modules.health_reports.schemas import HealthReportCreate
        from src.shared.pagination import PaginationParams

        user_id = uuid.uuid4()
        service = HealthReportService(db_session)

        # Create reports with various dates
        for d in report_dates:
            data = HealthReportCreate(
                report_date=d,
                markers={"hemoglobin": 14.0},
            )
            await service.upload_report(user_id=user_id, data=data)

        await db_session.commit()

        # Retrieve all reports
        result = await service.get_reports(
            user_id=user_id,
            pagination=PaginationParams(page=1, limit=100),
        )

        # Verify chronological ordering
        dates = [r.report_date for r in result.items]
        assert dates == sorted(dates), (
            f"Reports not in chronological order: {dates}"
        )
        assert result.total_count == len(report_dates)
