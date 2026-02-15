"""WeeklyReportService — aggregates training, nutrition, body metrics into a report."""

from __future__ import annotations

import logging
import uuid
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.adaptive.models import AdaptiveSnapshot
from src.modules.nutrition.models import NutritionEntry
from src.modules.reports.recommendations import generate_recommendations
from src.modules.reports.schemas import (
    BodyMetrics,
    NutritionMetrics,
    ReportContext,
    TrainingMetrics,
    WeeklyReportResponse,
)
from src.modules.training.analytics_schemas import PersonalRecord
from src.modules.training.analytics_service import TrainingAnalyticsService
from src.modules.training.exercise_mapping import get_muscle_group
from src.modules.user.models import BodyweightLog, UserGoal

logger = logging.getLogger(__name__)


class WeeklyReportService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_weekly_report(
        self, user_id: uuid.UUID, year: int, week: int
    ) -> WeeklyReportResponse:
        week_start, week_end = _iso_week_to_date_range(year, week)

        training = await self._build_training_metrics(user_id, week_start, week_end)
        nutrition, target_cal, days_logged = await self._build_nutrition_metrics(user_id, week_start, week_end)
        body = await self._build_body_metrics(user_id, week_start, week_end)
        goal_type, goal_rate = await self._fetch_goal(user_id)

        # --- Recommendations ---
        ctx = ReportContext(
            volume_by_muscle_group=dict(training.volume_by_muscle_group),
            sets_by_muscle_group={},  # populated below
            session_count=training.session_count,
            prs=training.personal_records,
            avg_calories=nutrition.avg_calories,
            target_calories=target_cal,
            compliance_pct=nutrition.compliance_pct,
            weight_trend=body.weight_trend_kg,
            goal_type=goal_type,
            goal_rate_per_week=goal_rate,
            days_logged_nutrition=days_logged,
            days_logged_training=training.session_count,
        )
        recs = generate_recommendations(ctx)

        return WeeklyReportResponse(
            year=year,
            week=week,
            week_start=week_start,
            week_end=week_end,
            training=training,
            nutrition=nutrition,
            body=body,
            recommendations=recs,
        )

    async def _build_training_metrics(
        self, user_id: uuid.UUID, week_start: date, week_end: date
    ) -> TrainingMetrics:
        """Aggregate training data for the week."""
        analytics = TrainingAnalyticsService(self.session)
        try:
            sessions = await analytics._fetch_sessions(user_id, week_start, week_end)
        except Exception:
            logger.exception("Failed to fetch training sessions for user=%s", user_id)
            return TrainingMetrics()

        total_volume = 0.0
        volume_by_mg: dict[str, float] = defaultdict(float)
        session_dates: set[date] = set()
        prs: list[PersonalRecord] = []

        for session_date, exercises in sessions:
            session_dates.add(session_date)
            for ex in exercises:
                mg = get_muscle_group(ex.get("exercise_name", ""))
                for s in ex.get("sets", []):
                    reps = s.get("reps", 0) or 0
                    weight = s.get("weight_kg", 0.0) or 0.0
                    vol = reps * weight
                    total_volume += vol
                    volume_by_mg[mg] += vol

        return TrainingMetrics(
            total_volume=round(total_volume, 2),
            volume_by_muscle_group={k: round(v, 2) for k, v in volume_by_mg.items()},
            session_count=len(session_dates),
            personal_records=prs,
        )

    async def _build_nutrition_metrics(
        self, user_id: uuid.UUID, week_start: date, week_end: date
    ) -> tuple[NutritionMetrics, float, int]:
        """Aggregate nutrition data. Returns (metrics, target_cal, days_logged)."""
        try:
            stmt = (
                select(NutritionEntry)
                .where(
                    NutritionEntry.user_id == user_id,
                    NutritionEntry.entry_date >= week_start,
                    NutritionEntry.entry_date <= week_end,
                )
            )
            stmt = NutritionEntry.not_deleted(stmt)
            result = await self.session.execute(stmt)
            entries = list(result.scalars().all())
        except Exception:
            logger.exception("Failed to fetch nutrition entries for user=%s", user_id)
            return NutritionMetrics(), 0.0, 0

        daily_cals: dict[date, float] = defaultdict(float)
        daily_pro: dict[date, float] = defaultdict(float)
        daily_carbs: dict[date, float] = defaultdict(float)
        daily_fat: dict[date, float] = defaultdict(float)

        for e in entries:
            daily_cals[e.entry_date] += e.calories or 0
            daily_pro[e.entry_date] += e.protein_g or 0
            daily_carbs[e.entry_date] += e.carbs_g or 0
            daily_fat[e.entry_date] += e.fat_g or 0

        days_logged = len(daily_cals)
        avg_cal = sum(daily_cals.values()) / days_logged if days_logged else 0
        avg_pro = sum(daily_pro.values()) / days_logged if days_logged else 0
        avg_carbs = sum(daily_carbs.values()) / days_logged if days_logged else 0
        avg_fat = sum(daily_fat.values()) / days_logged if days_logged else 0

        # Target calories from latest adaptive snapshot
        target_cal = 0.0
        tdee_delta = None
        try:
            snap_stmt = (
                select(AdaptiveSnapshot)
                .where(AdaptiveSnapshot.user_id == user_id)
                .order_by(AdaptiveSnapshot.created_at.desc())
                .limit(2)
            )
            snap_result = await self.session.execute(snap_stmt)
            snapshots = list(snap_result.scalars().all())

            if snapshots and snapshots[0].target_calories is not None:
                target_cal = snapshots[0].target_calories
            if len(snapshots) >= 2 and snapshots[1].target_calories is not None:
                tdee_delta = round(target_cal - snapshots[1].target_calories, 2)
        except Exception:
            logger.exception("Failed to fetch adaptive snapshots for user=%s", user_id)

        # Compliance
        compliant_days = 0
        if target_cal > 0 and days_logged > 0:
            for day_cal in daily_cals.values():
                if abs(day_cal - target_cal) / target_cal <= 0.05:
                    compliant_days += 1
        compliance_pct = round((compliant_days / days_logged) * 100, 1) if days_logged else 0.0

        nutrition = NutritionMetrics(
            avg_calories=round(avg_cal, 1),
            avg_protein_g=round(avg_pro, 1),
            avg_carbs_g=round(avg_carbs, 1),
            avg_fat_g=round(avg_fat, 1),
            target_calories=round(target_cal, 1),
            compliance_pct=compliance_pct,
            tdee_delta=tdee_delta,
            days_logged=days_logged,
        )
        return nutrition, target_cal, days_logged

    async def _build_body_metrics(
        self, user_id: uuid.UUID, week_start: date, week_end: date
    ) -> BodyMetrics:
        """Aggregate bodyweight data for the week."""
        try:
            bw_stmt = (
                select(BodyweightLog)
                .where(
                    BodyweightLog.user_id == user_id,
                    BodyweightLog.recorded_date >= week_start,
                    BodyweightLog.recorded_date <= week_end,
                )
                .order_by(BodyweightLog.recorded_date)
            )
            bw_result = await self.session.execute(bw_stmt)
            bw_logs = list(bw_result.scalars().all())
        except Exception:
            logger.exception("Failed to fetch bodyweight logs for user=%s", user_id)
            return BodyMetrics()

        if len(bw_logs) >= 2:
            return BodyMetrics(
                start_weight_kg=bw_logs[0].weight_kg,
                end_weight_kg=bw_logs[-1].weight_kg,
                weight_trend_kg=round(bw_logs[-1].weight_kg - bw_logs[0].weight_kg, 2),
            )
        elif len(bw_logs) == 1:
            return BodyMetrics(
                start_weight_kg=bw_logs[0].weight_kg,
                end_weight_kg=bw_logs[0].weight_kg,
                weight_trend_kg=None,
            )
        return BodyMetrics()

    async def _fetch_goal(self, user_id: uuid.UUID) -> tuple[str, float | None]:
        """Fetch user goal type and rate."""
        try:
            goal_stmt = select(UserGoal).where(UserGoal.user_id == user_id)
            goal_result = await self.session.execute(goal_stmt)
            goal = goal_result.scalar_one_or_none()
            return (goal.goal_type if goal else "maintaining", goal.goal_rate_per_week if goal else None)
        except Exception:
            logger.exception("Failed to fetch user goal for user=%s", user_id)
            return "maintaining", None


def _iso_week_to_date_range(year: int, week: int) -> tuple[date, date]:
    """Convert ISO year+week to (Monday, Sunday) date range.

    Uses the ISO 8601 definition: week 1 contains January 4th.
    Raises ValueError for invalid week numbers.
    """
    if week < 1 or week > 53:
        raise ValueError(f"ISO week must be between 1 and 53, got {week}")
    if year < 2000 or year > 2100:
        raise ValueError(f"Year must be between 2000 and 2100, got {year}")

    jan4 = date(year, 1, 4)
    start_of_week1 = jan4 - timedelta(days=jan4.weekday())
    monday = start_of_week1 + timedelta(weeks=week - 1)
    sunday = monday + timedelta(days=6)
    return monday, sunday
