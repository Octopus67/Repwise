"""YearlyReportService — aggregates training, nutrition, body metrics for a calendar year."""

from __future__ import annotations

import logging
import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.achievements.models import AchievementProgress
from src.modules.reports.yearly_schemas import (
    YearlyBodyMetrics,
    YearlyNutritionMetrics,
    YearlyReportResponse,
    YearlyTrainingMetrics,
)
from src.modules.reports.service import WeeklyReportService
from src.modules.training.models import PersonalRecord

logger = logging.getLogger(__name__)


class YearlyReportService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self._weekly = WeeklyReportService(session)

    async def get_yearly_report(self, user_id: uuid.UUID, year: int) -> YearlyReportResponse:
        year_start = date(year, 1, 1)
        year_end = date(year, 12, 31)

        training = await self._weekly._build_training_metrics(user_id, year_start, year_end)
        nutrition, _, _ = await self._weekly._build_nutrition_metrics(user_id, year_start, year_end)
        body = await self._weekly._build_body_metrics(user_id, year_start, year_end)

        total_prs = await self._count_prs(user_id, year_start, year_end)
        longest_streak = await self._get_longest_streak(user_id)
        most_trained = self._most_trained_muscle(training.volume_by_muscle_group)

        return YearlyReportResponse(
            year=year,
            year_start=year_start,
            year_end=year_end,
            training=YearlyTrainingMetrics(
                total_volume=training.total_volume,
                session_count=training.session_count,
                volume_by_muscle_group=training.volume_by_muscle_group,
            ),
            nutrition=YearlyNutritionMetrics(
                avg_calories=nutrition.avg_calories,
                avg_protein_g=nutrition.avg_protein_g,
                avg_carbs_g=nutrition.avg_carbs_g,
                avg_fat_g=nutrition.avg_fat_g,
                compliance_pct=nutrition.compliance_pct,
                days_logged=nutrition.days_logged,
            ),
            body=YearlyBodyMetrics(
                start_weight_kg=body.start_weight_kg,
                end_weight_kg=body.end_weight_kg,
                weight_change_kg=body.weight_trend_kg,
            ),
            total_workouts=training.session_count,
            total_prs=total_prs,
            longest_streak=longest_streak,
            most_trained_muscle=most_trained,
        )

    async def _count_prs(self, user_id: uuid.UUID, start: date, end: date) -> int:
        stmt = (
            select(func.count())
            .select_from(PersonalRecord)
            .where(
                PersonalRecord.user_id == user_id,
                func.date(PersonalRecord.achieved_at) >= start,
                func.date(PersonalRecord.achieved_at) <= end,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one() or 0

    async def _get_longest_streak(self, user_id: uuid.UUID) -> int:
        stmt = select(AchievementProgress).where(
            AchievementProgress.user_id == user_id,
            AchievementProgress.progress_type == "streak",
        )
        result = await self.session.execute(stmt)
        progress = result.scalar_one_or_none()
        if progress is None:
            return 0
        meta = progress.metadata_ or {}
        try:
            return max(0, int(meta.get("longest_streak", 0)))
        except (TypeError, ValueError):
            return 0

    @staticmethod
    def _most_trained_muscle(volume_by_mg: dict[str, float]) -> str | None:
        if not volume_by_mg:
            return None
        return max(volume_by_mg, key=volume_by_mg.get)  # type: ignore[arg-type]
