"""Recomp service — orchestrates DB access and pure engine calls."""

from __future__ import annotations
from typing import Optional

import logging
import uuid
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.recomp.engine import (
    MeasurementPoint,
    RecompCheckinInput,
    RecompCheckinOutput,
    RecompMetricsInput,
    RecompMetricsOutput,
    compute_recomp_checkin,
    compute_recomp_score,
)
from src.modules.recomp.models import RecompMeasurement
from src.modules.recomp.schemas import RecompMeasurementCreate
from src.modules.user.models import BodyweightLog

logger = logging.getLogger(__name__)


class RecompService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def log_measurement(
        self, user_id: uuid.UUID, data: RecompMeasurementCreate,
    ) -> RecompMeasurement:
        logger.info("Logging recomp measurement for user %s on %s", user_id, data.recorded_date)
        entry = RecompMeasurement(
            user_id=user_id,
            recorded_date=data.recorded_date,
            waist_cm=data.waist_cm,
            arm_cm=data.arm_cm,
            chest_cm=data.chest_cm,
        )
        self.session.add(entry)
        await self.session.flush()
        await self.session.refresh(entry)
        return entry

    async def get_measurements(
        self, user_id: uuid.UUID, start_date: date, end_date: date,
    ) -> list[RecompMeasurement]:
        if start_date > end_date:
            logger.warning("start_date %s > end_date %s, swapping", start_date, end_date)
            start_date, end_date = end_date, start_date
        stmt = (
            select(RecompMeasurement)
            .where(
                RecompMeasurement.user_id == user_id,
                RecompMeasurement.recorded_date >= start_date,
                RecompMeasurement.recorded_date <= end_date,
            )
            .order_by(RecompMeasurement.recorded_date.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_recomp_metrics(
        self, user_id: uuid.UUID, lookback_days: int = 28,
    ) -> RecompMetricsOutput:
        today = date.today()
        start = today - timedelta(days=lookback_days + 7)  # extra buffer

        measurements = await self.get_measurements(user_id, start, today)

        waist = [MeasurementPoint(m.recorded_date, m.waist_cm) for m in measurements if m.waist_cm is not None]
        arm = [MeasurementPoint(m.recorded_date, m.arm_cm) for m in measurements if m.arm_cm is not None]
        chest = [MeasurementPoint(m.recorded_date, m.chest_cm) for m in measurements if m.chest_cm is not None]

        # Fetch bodyweight
        bw_stmt = (
            select(BodyweightLog)
            .where(BodyweightLog.user_id == user_id, BodyweightLog.recorded_date >= start)
            .order_by(BodyweightLog.recorded_date.asc())
        )
        bw_result = await self.session.execute(bw_stmt)
        bw_logs = list(bw_result.scalars().all())
        weight = [MeasurementPoint(b.recorded_date, b.weight_kg) for b in bw_logs]

        inp = RecompMetricsInput(
            waist_measurements=waist,
            arm_measurements=arm,
            chest_measurements=chest,
            bodyweight_history=weight,
            lookback_days=lookback_days,
        )
        return compute_recomp_score(inp)

    async def get_weekly_checkin(self, user_id: uuid.UUID) -> RecompCheckinOutput:
        metrics = await self.get_recomp_metrics(user_id)

        # Compute weekly weight change from bodyweight logs
        weekly_weight_change: Optional[float] = None
        today = date.today()
        bw_stmt = (
            select(BodyweightLog)
            .where(BodyweightLog.user_id == user_id, BodyweightLog.recorded_date >= today - timedelta(days=14))
            .order_by(BodyweightLog.recorded_date.asc())
        )
        bw_result = await self.session.execute(bw_stmt)
        bw_logs = list(bw_result.scalars().all())
        if len(bw_logs) >= 2:
            weekly_weight_change = bw_logs[-1].weight_kg - bw_logs[0].weight_kg

        inp = RecompCheckinInput(
            recomp_metrics=metrics,
            weekly_weight_change_kg=weekly_weight_change,
            current_training_day_surplus_pct=0.10,
            current_rest_day_deficit_pct=-0.10,
        )
        return compute_recomp_checkin(inp)
