"""MonthlyReportService — aggregates training, nutrition, body metrics for a calendar month."""

from __future__ import annotations

import calendar
import logging
import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.reports.monthly_schemas import (
    MonthlyBodyMetrics,
    MonthlyNutritionMetrics,
    MonthlyReportResponse,
    MonthlyTrainingMetrics,
    MomDelta,
)
from src.modules.reports.service import WeeklyReportService

logger = logging.getLogger(__name__)


class MonthlyReportService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self._weekly = WeeklyReportService(session)

    async def get_monthly_report(
        self, user_id: uuid.UUID, year: int, month: int
    ) -> MonthlyReportResponse:
        month_start = date(year, month, 1)
        month_end = date(year, month, calendar.monthrange(year, month)[1])

        # Current month metrics
        training = await self._weekly._build_training_metrics(user_id, month_start, month_end)
        nutrition, _, _ = await self._weekly._build_nutrition_metrics(user_id, month_start, month_end)
        body = await self._weekly._build_body_metrics(user_id, month_start, month_end)

        # Previous month metrics for MoM delta
        if month == 1:
            prev_year, prev_month = year - 1, 12
        else:
            prev_year, prev_month = year, month - 1
        prev_start = date(prev_year, prev_month, 1)
        prev_end = date(prev_year, prev_month, calendar.monthrange(prev_year, prev_month)[1])

        prev_training = await self._weekly._build_training_metrics(user_id, prev_start, prev_end)
        prev_nutrition, _, _ = await self._weekly._build_nutrition_metrics(user_id, prev_start, prev_end)
        prev_body = await self._weekly._build_body_metrics(user_id, prev_start, prev_end)

        # Build MoM delta
        delta = MomDelta(
            volume_delta=round(training.total_volume - prev_training.total_volume, 2),
            session_delta=training.session_count - prev_training.session_count,
            avg_calories_delta=round(nutrition.avg_calories - prev_nutrition.avg_calories, 1),
            avg_protein_delta=round(nutrition.avg_protein_g - prev_nutrition.avg_protein_g, 1),
            compliance_delta=round(nutrition.compliance_pct - prev_nutrition.compliance_pct, 1),
            weight_change_delta=_weight_delta(body, prev_body),
        )

        return MonthlyReportResponse(
            year=year,
            month=month,
            month_start=month_start,
            month_end=month_end,
            training=MonthlyTrainingMetrics(
                total_volume=training.total_volume,
                session_count=training.session_count,
                volume_by_muscle_group=training.volume_by_muscle_group,
            ),
            nutrition=MonthlyNutritionMetrics(
                avg_calories=nutrition.avg_calories,
                avg_protein_g=nutrition.avg_protein_g,
                avg_carbs_g=nutrition.avg_carbs_g,
                avg_fat_g=nutrition.avg_fat_g,
                compliance_pct=nutrition.compliance_pct,
                days_logged=nutrition.days_logged,
            ),
            body=MonthlyBodyMetrics(
                start_weight_kg=body.start_weight_kg,
                end_weight_kg=body.end_weight_kg,
                weight_change_kg=body.weight_trend_kg,
            ),
            previous_month_delta=delta,
        )


def _weight_delta(current: object, previous: object) -> float | None:
    cur = getattr(current, "weight_trend_kg", None)
    prev = getattr(previous, "weight_trend_kg", None)
    if cur is not None and prev is not None:
        return round(cur - prev, 2)
    return None
