"""Unit + integration tests for the micronutrient dashboard service.

Tests pure functions (aggregation, scoring, deficiency detection) and
the full service with DB-backed nutrition entries.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.auth.models import User
from src.modules.nutrition.models import NutritionEntry
from src.modules.nutrition.micro_dashboard_service import (
    NutrientSummary,
    aggregate_micros,
    compute_nutrient_score,
    detect_deficiencies,
    MicronutrientDashboardService,
    RDA_VALUES,
)


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _entry(micros: dict[str, float]) -> dict:
    return {"micro_nutrients": micros}


async def _create_user(db: AsyncSession, email: str) -> User:
    user = User(
        id=uuid.uuid4(), email=email, hashed_password="x", auth_provider="email", role="user"
    )
    db.add(user)
    await db.flush()
    return user


async def _log_nutrition(
    db: AsyncSession,
    user_id: uuid.UUID,
    entry_date: date,
    calories: float,
    micros: dict[str, float],
) -> None:
    entry = NutritionEntry(
        user_id=user_id,
        entry_date=entry_date,
        meal_name="lunch",
        calories=calories,
        protein_g=30,
        carbs_g=40,
        fat_g=10,
        micro_nutrients=micros,
    )
    db.add(entry)
    await db.flush()


# ─── Pure Function Tests ──────────────────────────────────────────────────────


class TestAggregateMicros:
    def test_empty_entries(self):
        result = aggregate_micros([], 7, "male")
        assert len(result) == 27
        assert all(n.daily_average == 0 for n in result)

    def test_single_day_single_entry(self):
        entries = [_entry({"vitamin_c_mg": 90})]
        result = aggregate_micros(entries, 1, "male")
        vc = next(n for n in result if n.key == "vitamin_c_mg")
        assert vc.daily_average == 90.0
        assert vc.rda == 90.0
        assert vc.rda_pct == 100.0
        assert vc.status == "adequate"

    def test_seven_day_average(self):
        entries = [_entry({"iron_mg": 10})] * 7
        result = aggregate_micros(entries, 7, "female")
        iron = next(n for n in result if n.key == "iron_mg")
        assert iron.daily_average == 10.0
        assert iron.rda == 18.0  # female RDA
        assert iron.rda_pct == pytest.approx(55.6, abs=0.1)
        assert iron.status == "low"

    def test_sex_affects_rda(self):
        entries = [_entry({"iron_mg": 10})]
        male = next(n for n in aggregate_micros(entries, 1, "male") if n.key == "iron_mg")
        female = next(n for n in aggregate_micros(entries, 1, "female") if n.key == "iron_mg")
        assert male.rda == 8.0
        assert female.rda == 18.0
        assert male.rda_pct > female.rda_pct

    def test_deficient_status(self):
        entries = [_entry({"calcium_mg": 200})]
        result = aggregate_micros(entries, 1, "male")
        ca = next(n for n in result if n.key == "calcium_mg")
        assert ca.rda_pct == 20.0
        assert ca.status == "deficient"

    def test_excess_status(self):
        entries = [_entry({"sodium_mg": 4000})]
        result = aggregate_micros(entries, 1, "male")
        na = next(n for n in result if n.key == "sodium_mg")
        assert na.rda_pct > 120
        assert na.status == "excess"


class TestComputeNutrientScore:
    def test_perfect_score(self):
        nutrients = [
            NutrientSummary(
                key=k,
                label="",
                unit="",
                group="",
                daily_average=0,
                rda=100,
                rda_pct=100,
                status="adequate",
            )
            for k in RDA_VALUES
        ]
        score = compute_nutrient_score(nutrients)
        assert score == 100.0

    def test_zero_score(self):
        nutrients = [
            NutrientSummary(
                key=k,
                label="",
                unit="",
                group="",
                daily_average=0,
                rda=100,
                rda_pct=0,
                status="deficient",
            )
            for k in RDA_VALUES
            if k not in ("sodium_mg", "cholesterol_mg")
        ]
        score = compute_nutrient_score(nutrients)
        assert score == 0.0

    def test_excess_capped_at_100(self):
        nutrients = [
            NutrientSummary(
                key="vitamin_c_mg",
                label="",
                unit="",
                group="",
                daily_average=200,
                rda=90,
                rda_pct=222,
                status="excess",
            ),
        ]
        score = compute_nutrient_score(nutrients)
        assert score == 100.0  # capped

    def test_sodium_excess_penalized(self):
        nutrients = [
            NutrientSummary(
                key="sodium_mg",
                label="",
                unit="",
                group="",
                daily_average=4600,
                rda=2300,
                rda_pct=200,
                status="excess",
            ),
        ]
        score = compute_nutrient_score(nutrients)
        assert score == 0.0  # 100% over → 0 score

    def test_empty_returns_zero(self):
        assert compute_nutrient_score([]) == 0.0


class TestDetectDeficiencies:
    def test_no_deficiencies_when_adequate(self):
        daily = [{"vitamin_c_mg": 90, "iron_mg": 18}] * 7
        alerts = detect_deficiencies(daily, "female")
        vc_alert = [a for a in alerts if a.key == "vitamin_c_mg"]
        assert len(vc_alert) == 0

    def test_consistent_deficiency_detected(self):
        daily = [{"iron_mg": 2}] * 7  # way below 18mg RDA for female
        alerts = detect_deficiencies(daily, "female")
        iron_alert = [a for a in alerts if a.key == "iron_mg"]
        assert len(iron_alert) == 1
        assert iron_alert[0].days_below_50pct == 7
        assert iron_alert[0].deficit_pct > 80

    def test_intermittent_deficiency_not_flagged(self):
        # 4 good days, 3 bad days → only 3/7 below 50% → not flagged (need ≥50%)
        daily = [{"vitamin_c_mg": 90}] * 4 + [{"vitamin_c_mg": 10}] * 3
        alerts = detect_deficiencies(daily, "male")
        vc_alert = [a for a in alerts if a.key == "vitamin_c_mg"]
        assert len(vc_alert) == 0

    def test_sodium_excluded(self):
        daily = [{"sodium_mg": 100}] * 7  # low sodium is good, not a deficiency
        alerts = detect_deficiencies(daily, "male")
        na_alert = [a for a in alerts if a.key == "sodium_mg"]
        assert len(na_alert) == 0

    def test_sorted_by_deficit(self):
        daily = [{"iron_mg": 1, "calcium_mg": 100}] * 7
        alerts = detect_deficiencies(daily, "female")
        if len(alerts) >= 2:
            assert alerts[0].deficit_pct >= alerts[1].deficit_pct


# ─── Integration Tests ────────────────────────────────────────────────────────


class TestMicronutrientDashboardIntegration:
    """Full DB-backed tests simulating a week of nutrition logging."""

    @pytest.fixture
    async def setup(self, db_session: AsyncSession):
        user = await _create_user(db_session, "micro_test@test.com")
        base = date(2026, 3, 2)  # Monday

        # Day 1: Good nutrition
        await _log_nutrition(
            db_session,
            user.id,
            base,
            2000,
            {
                "vitamin_c_mg": 120,
                "iron_mg": 12,
                "calcium_mg": 800,
                "vitamin_d_mcg": 10,
                "zinc_mg": 8,
                "magnesium_mg": 300,
                "fibre_g": 30,
                "sodium_mg": 2000,
            },
        )
        # Day 2: Poor nutrition
        await _log_nutrition(
            db_session,
            user.id,
            base + timedelta(days=1),
            1500,
            {
                "vitamin_c_mg": 20,
                "iron_mg": 3,
                "calcium_mg": 200,
                "sodium_mg": 3500,
            },
        )
        # Day 3: Moderate
        await _log_nutrition(
            db_session,
            user.id,
            base + timedelta(days=2),
            1800,
            {
                "vitamin_c_mg": 60,
                "iron_mg": 8,
                "calcium_mg": 500,
                "vitamin_d_mcg": 5,
                "fibre_g": 15,
            },
        )
        # Days 4-7: No data logged

        await db_session.commit()
        return user, base

    async def test_dashboard_returns_all_nutrients(self, db_session: AsyncSession, setup):
        user, base = setup
        svc = MicronutrientDashboardService(db_session)
        dashboard = await svc.get_dashboard(user.id, base, base + timedelta(days=6), "male")

        assert dashboard.days_tracked == 7
        assert dashboard.days_with_data == 3
        assert len(dashboard.nutrients) == 27

    async def test_daily_averages_correct(self, db_session: AsyncSession, setup):
        user, base = setup
        svc = MicronutrientDashboardService(db_session)
        dashboard = await svc.get_dashboard(user.id, base, base + timedelta(days=6), "male")

        vc = next(n for n in dashboard.nutrients if n.key == "vitamin_c_mg")
        # Total: 120 + 20 + 60 = 200, over 7 days = 28.57
        assert vc.daily_average == pytest.approx(28.57, abs=0.1)

    async def test_nutrient_score_computed(self, db_session: AsyncSession, setup):
        user, base = setup
        svc = MicronutrientDashboardService(db_session)
        dashboard = await svc.get_dashboard(user.id, base, base + timedelta(days=6), "male")

        assert 0 <= dashboard.nutrient_score <= 100
        # With sparse data over 7 days, score should be low
        assert dashboard.nutrient_score < 50

    async def test_deficiencies_detected(self, db_session: AsyncSession, setup):
        user, base = setup
        svc = MicronutrientDashboardService(db_session)
        dashboard = await svc.get_dashboard(user.id, base, base + timedelta(days=6), "male")

        # Many nutrients have zero intake on 4+ days → should flag deficiencies
        assert len(dashboard.deficiencies) > 0
        deficient_keys = {d.key for d in dashboard.deficiencies}
        # Vitamin D only logged 2 of 7 days at low amounts → should be deficient
        assert "vitamin_d_mcg" in deficient_keys

    async def test_top_and_worst_nutrients(self, db_session: AsyncSession, setup):
        user, base = setup
        svc = MicronutrientDashboardService(db_session)
        dashboard = await svc.get_dashboard(user.id, base, base + timedelta(days=6), "male")

        assert len(dashboard.top_nutrients) <= 5
        assert len(dashboard.worst_nutrients) <= 5
        if dashboard.top_nutrients and dashboard.worst_nutrients:
            assert dashboard.top_nutrients[0].rda_pct >= dashboard.worst_nutrients[0].rda_pct

    async def test_sex_affects_results(self, db_session: AsyncSession, setup):
        user, base = setup
        svc = MicronutrientDashboardService(db_session)
        male = await svc.get_dashboard(user.id, base, base + timedelta(days=6), "male")
        female = await svc.get_dashboard(user.id, base, base + timedelta(days=6), "female")

        male_iron = next(n for n in male.nutrients if n.key == "iron_mg")
        female_iron = next(n for n in female.nutrients if n.key == "iron_mg")
        # Same intake but female RDA is higher → lower percentage
        assert male_iron.rda_pct > female_iron.rda_pct
