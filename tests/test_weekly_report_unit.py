"""Unit tests for the Weekly Intelligence Report feature.

Tests cover:
- _iso_week_to_date_range: boundary calculations, invalid inputs
- generate_recommendations: empty data, partial data, various rule triggers
- Schema validation: upper bounds, required fields, edge cases
- Router validation: week/year parameter bounds
"""

from __future__ import annotations

from datetime import date

import pytest

from src.modules.reports.recommendations import generate_recommendations
from src.modules.reports.schemas import (
    BodyMetrics,
    NutritionMetrics,
    ReportContext,
    TrainingMetrics,
    WeeklyReportResponse,
)
from src.modules.reports.service import _iso_week_to_date_range


# ─── _iso_week_to_date_range tests ──────────────────────────────────────────


class TestIsoWeekToDateRange:
    """Tests for the ISO week → date range conversion."""

    def test_week_1_2024(self):
        """ISO week 1 of 2024 starts on Monday Jan 1."""
        monday, sunday = _iso_week_to_date_range(2024, 1)
        assert monday == date(2024, 1, 1)
        assert sunday == date(2024, 1, 7)
        assert monday.weekday() == 0  # Monday
        assert sunday.weekday() == 6  # Sunday

    def test_week_52_2024(self):
        """ISO week 52 of 2024."""
        monday, sunday = _iso_week_to_date_range(2024, 52)
        assert monday.weekday() == 0
        assert sunday.weekday() == 6
        assert (sunday - monday).days == 6

    def test_week_1_2025(self):
        """ISO week 1 of 2025 starts on Monday Dec 30, 2024."""
        monday, sunday = _iso_week_to_date_range(2025, 1)
        assert monday == date(2024, 12, 30)
        assert sunday == date(2025, 1, 5)

    def test_range_always_7_days(self):
        """Every week range should span exactly 7 days (Mon-Sun)."""
        for week in range(1, 53):
            monday, sunday = _iso_week_to_date_range(2024, week)
            assert (sunday - monday).days == 6
            assert monday.weekday() == 0
            assert sunday.weekday() == 6

    def test_invalid_week_zero(self):
        """Week 0 should raise ValueError."""
        with pytest.raises(ValueError, match="ISO week must be between 1 and 53"):
            _iso_week_to_date_range(2024, 0)

    def test_invalid_week_negative(self):
        """Negative week should raise ValueError."""
        with pytest.raises(ValueError, match="ISO week must be between 1 and 53"):
            _iso_week_to_date_range(2024, -1)

    def test_invalid_week_54(self):
        """Week 54 should raise ValueError."""
        with pytest.raises(ValueError, match="ISO week must be between 1 and 53"):
            _iso_week_to_date_range(2024, 54)

    def test_invalid_year_too_low(self):
        """Year below 2000 should raise ValueError."""
        with pytest.raises(ValueError, match="Year must be between 2000 and 2100"):
            _iso_week_to_date_range(1999, 1)

    def test_invalid_year_too_high(self):
        """Year above 2100 should raise ValueError."""
        with pytest.raises(ValueError, match="Year must be between 2000 and 2100"):
            _iso_week_to_date_range(2101, 1)

    def test_iso_year_with_53_weeks(self):
        """2020 is an ISO year with 53 weeks — week 53 should be valid."""
        monday, sunday = _iso_week_to_date_range(2020, 53)
        assert monday.weekday() == 0
        assert sunday.weekday() == 6
        assert (sunday - monday).days == 6


# ─── generate_recommendations tests ─────────────────────────────────────────


class TestGenerateRecommendations:
    """Tests for the rule-based recommendation engine."""

    def test_empty_data_produces_valid_recommendations(self):
        """No data at all should produce 2 logging-encouragement recommendations."""
        ctx = ReportContext()
        recs = generate_recommendations(ctx)
        assert len(recs) >= 2
        assert len(recs) <= 3
        assert any("logging" in r.lower() or "log" in r.lower() for r in recs)

    def test_training_only_no_nutrition(self):
        """Training data but no nutrition should still produce recommendations."""
        ctx = ReportContext(
            session_count=3,
            days_logged_training=3,
            days_logged_nutrition=0,
            volume_by_muscle_group={"chest": 5000, "back": 4000},
            sets_by_muscle_group={"chest": 12, "back": 10},
        )
        recs = generate_recommendations(ctx)
        assert len(recs) >= 2
        assert len(recs) <= 3

    def test_nutrition_only_no_training(self):
        """Nutrition data but no training should still produce recommendations."""
        ctx = ReportContext(
            days_logged_nutrition=5,
            days_logged_training=0,
            avg_calories=2000,
            target_calories=2200,
            compliance_pct=45.0,
        )
        recs = generate_recommendations(ctx)
        assert len(recs) >= 2
        assert len(recs) <= 3

    def test_high_compliance_triggers_positive_message(self):
        """Compliance > 85% should trigger a positive recommendation."""
        ctx = ReportContext(
            days_logged_nutrition=7,
            days_logged_training=4,
            session_count=4,
            compliance_pct=92.0,
            avg_calories=2200,
            target_calories=2200,
            sets_by_muscle_group={"chest": 12, "back": 12, "shoulders": 10},
        )
        recs = generate_recommendations(ctx)
        assert any("compliance" in r.lower() or "keep it up" in r.lower() for r in recs)

    def test_low_compliance_triggers_improvement_message(self):
        """Compliance < 60% should trigger an improvement recommendation."""
        ctx = ReportContext(
            days_logged_nutrition=5,
            days_logged_training=3,
            session_count=3,
            compliance_pct=40.0,
            avg_calories=1800,
            target_calories=2500,
            sets_by_muscle_group={"chest": 12, "back": 12},
        )
        recs = generate_recommendations(ctx)
        assert any("consistency" in r.lower() or "prep" in r.lower() for r in recs)

    def test_cutting_weight_down_on_track(self):
        """Cutting goal with weight trending down should be positive."""
        ctx = ReportContext(
            days_logged_nutrition=7,
            days_logged_training=4,
            session_count=4,
            compliance_pct=80.0,
            weight_trend=-0.5,
            goal_type="cutting",
            sets_by_muscle_group={"chest": 12, "back": 12},
        )
        recs = generate_recommendations(ctx)
        assert any("on track" in r.lower() or "trending down" in r.lower() for r in recs)

    def test_cutting_weight_up_warning(self):
        """Cutting goal with weight trending up should warn."""
        ctx = ReportContext(
            days_logged_nutrition=7,
            days_logged_training=4,
            session_count=4,
            compliance_pct=70.0,
            weight_trend=0.5,
            goal_type="cutting",
            sets_by_muscle_group={"chest": 12, "back": 12},
        )
        recs = generate_recommendations(ctx)
        assert any("reducing" in r.lower() or "trending up" in r.lower() for r in recs)

    def test_bulking_weight_up_on_track(self):
        """Bulking goal with weight trending up should be positive."""
        ctx = ReportContext(
            days_logged_nutrition=7,
            days_logged_training=5,
            session_count=5,
            compliance_pct=80.0,
            weight_trend=0.3,
            goal_type="bulking",
            sets_by_muscle_group={"chest": 12, "back": 12},
        )
        recs = generate_recommendations(ctx)
        assert any("on track" in r.lower() or "trending up" in r.lower() for r in recs)

    def test_under_mev_muscle_group(self):
        """A muscle group below MEV should trigger a volume recommendation."""
        ctx = ReportContext(
            days_logged_nutrition=5,
            days_logged_training=3,
            session_count=3,
            compliance_pct=70.0,
            sets_by_muscle_group={"chest": 2, "back": 10},  # chest MEV is 10
        )
        recs = generate_recommendations(ctx)
        assert any("chest" in r.lower() and "volume" in r.lower() for r in recs)

    def test_max_three_recommendations(self):
        """Should never return more than 3 recommendations."""
        ctx = ReportContext(
            days_logged_nutrition=7,
            days_logged_training=5,
            session_count=5,
            compliance_pct=40.0,
            weight_trend=0.5,
            goal_type="cutting",
            sets_by_muscle_group={"chest": 2, "back": 2, "shoulders": 1},
        )
        recs = generate_recommendations(ctx)
        assert len(recs) <= 3

    def test_at_least_two_recommendations(self):
        """Should always return at least 2 recommendations."""
        ctx = ReportContext(
            days_logged_nutrition=7,
            days_logged_training=5,
            session_count=5,
            compliance_pct=75.0,
            sets_by_muscle_group={"chest": 12, "back": 12, "shoulders": 10},
        )
        recs = generate_recommendations(ctx)
        assert len(recs) >= 2


# ─── Schema validation tests ────────────────────────────────────────────────


class TestSchemaValidation:
    """Tests for Pydantic schema constraints."""

    def test_training_metrics_defaults(self):
        """TrainingMetrics with no args should produce valid defaults."""
        m = TrainingMetrics()
        assert m.total_volume == 0.0
        assert m.session_count == 0
        assert m.volume_by_muscle_group == {}
        assert m.personal_records == []

    def test_nutrition_metrics_defaults(self):
        """NutritionMetrics with no args should produce valid defaults."""
        m = NutritionMetrics()
        assert m.avg_calories == 0.0
        assert m.days_logged == 0
        assert m.compliance_pct == 0.0

    def test_body_metrics_defaults(self):
        """BodyMetrics with no args should produce valid defaults."""
        m = BodyMetrics()
        assert m.start_weight_kg is None
        assert m.end_weight_kg is None
        assert m.weight_trend_kg is None

    def test_training_metrics_rejects_negative_volume(self):
        """Negative total_volume should be rejected."""
        with pytest.raises(Exception):
            TrainingMetrics(total_volume=-1.0)

    def test_nutrition_metrics_rejects_negative_calories(self):
        """Negative avg_calories should be rejected."""
        with pytest.raises(Exception):
            NutritionMetrics(avg_calories=-100)

    def test_compliance_pct_rejects_over_100(self):
        """Compliance > 100% should be rejected."""
        with pytest.raises(Exception):
            NutritionMetrics(compliance_pct=101.0)

    def test_weekly_report_response_valid(self):
        """A fully populated WeeklyReportResponse should validate."""
        r = WeeklyReportResponse(
            year=2024,
            week=10,
            week_start=date(2024, 3, 4),
            week_end=date(2024, 3, 10),
            training=TrainingMetrics(),
            nutrition=NutritionMetrics(),
            body=BodyMetrics(),
            recommendations=["Keep going!"],
        )
        assert r.year == 2024
        assert r.week == 10
        assert len(r.recommendations) == 1

    def test_weekly_report_rejects_invalid_year(self):
        """Year outside 2000-2100 should be rejected."""
        with pytest.raises(Exception):
            WeeklyReportResponse(
                year=1900,
                week=1,
                week_start=date(2024, 1, 1),
                week_end=date(2024, 1, 7),
                training=TrainingMetrics(),
                nutrition=NutritionMetrics(),
                body=BodyMetrics(),
            )

    def test_weekly_report_rejects_invalid_week(self):
        """Week outside 1-53 should be rejected."""
        with pytest.raises(Exception):
            WeeklyReportResponse(
                year=2024,
                week=0,
                week_start=date(2024, 1, 1),
                week_end=date(2024, 1, 7),
                training=TrainingMetrics(),
                nutrition=NutritionMetrics(),
                body=BodyMetrics(),
            )

    def test_report_context_dataclass_defaults(self):
        """ReportContext with no args should have sensible defaults."""
        ctx = ReportContext()
        assert ctx.session_count == 0
        assert ctx.avg_calories == 0.0
        assert ctx.goal_type == "maintaining"
        assert ctx.weight_trend is None
        assert ctx.days_logged_nutrition == 0
