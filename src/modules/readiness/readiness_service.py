"""Readiness Service — async orchestration layer."""

from __future__ import annotations

import logging
import uuid
from datetime import date, timedelta
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.readiness.readiness_engine import (
    Baselines,
    HealthMetrics,
    UserCheckin,
    compute_baselines,
    compute_readiness,
)
from src.modules.readiness.readiness_models import RecoveryCheckin, ReadinessScore
from src.modules.readiness.readiness_schemas import (
    CheckinRequest,
    CheckinResponse,
    FactorScoreResponse,
    HealthMetricsRequest,
    ReadinessHistoryResponse,
    ReadinessScoreResponse,
)
from src.shared.errors import ApiError

logger = logging.getLogger(__name__)

MAX_HISTORY_DAYS = 365


class ReadinessService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def submit_checkin(
        self, user_id: uuid.UUID, data: CheckinRequest
    ) -> CheckinResponse:
        """Upsert recovery check-in for the given date."""
        try:
            stmt = select(RecoveryCheckin).where(
                RecoveryCheckin.user_id == user_id,
                RecoveryCheckin.checkin_date == data.checkin_date,
            )
            result = await self.session.execute(stmt)
            existing = result.scalar_one_or_none()

            if existing:
                existing.soreness = data.soreness
                existing.stress = data.stress
                existing.sleep_quality = data.sleep_quality
            else:
                existing = RecoveryCheckin(
                    user_id=user_id,
                    soreness=data.soreness,
                    stress=data.stress,
                    sleep_quality=data.sleep_quality,
                    checkin_date=data.checkin_date,
                )
                self.session.add(existing)

            await self.session.commit()
            await self.session.refresh(existing)
            logger.info("Checkin upserted for user=%s date=%s", user_id, data.checkin_date)
            return CheckinResponse.model_validate(existing)
        except ApiError:
            raise
        except Exception:
            logger.exception("Failed to submit checkin for user=%s", user_id)
            raise ApiError(
                status=500, code="INTERNAL_ERROR",
                message="Failed to save recovery check-in",
            )

    async def compute_score(
        self,
        user_id: uuid.UUID,
        health_req: HealthMetricsRequest,
        target_date: Optional[date] = None,
    ) -> ReadinessScoreResponse:
        """Compute readiness score: fetch baselines + checkin, call engine, upsert."""
        try:
            score_date = target_date or date.today()
            start = score_date - timedelta(days=30)

            # Fetch 30-day score history for baselines
            stmt = select(ReadinessScore).where(
                ReadinessScore.user_id == user_id,
                ReadinessScore.score_date >= start,
                ReadinessScore.score_date <= score_date,
            ).order_by(ReadinessScore.score_date)
            result = await self.session.execute(stmt)
            history = list(result.scalars().all())

            hrv_history = [s.hrv_ms for s in history if s.hrv_ms is not None]
            rhr_history = [s.resting_hr_bpm for s in history if s.resting_hr_bpm is not None]
            baselines = compute_baselines(hrv_history, rhr_history)

            # Fetch today's check-in
            checkin_stmt = select(RecoveryCheckin).where(
                RecoveryCheckin.user_id == user_id,
                RecoveryCheckin.checkin_date == score_date,
            )
            checkin_result = await self.session.execute(checkin_stmt)
            checkin_row = checkin_result.scalar_one_or_none()

            health = HealthMetrics(
                hrv_ms=health_req.hrv_ms,
                resting_hr_bpm=health_req.resting_hr_bpm,
                sleep_duration_hours=health_req.sleep_duration_hours,
            )
            user_checkin = None
            if checkin_row:
                user_checkin = UserCheckin(
                    soreness=checkin_row.soreness,
                    stress=checkin_row.stress,
                    sleep_quality=checkin_row.sleep_quality,
                )

            engine_result = compute_readiness(health, user_checkin, baselines)

            # Upsert score
            score_stmt = select(ReadinessScore).where(
                ReadinessScore.user_id == user_id,
                ReadinessScore.score_date == score_date,
            )
            score_result = await self.session.execute(score_stmt)
            existing_score = score_result.scalar_one_or_none()

            factors_data: List[dict] = [
                {"name": f.name, "normalized": f.normalized, "weight": f.weight,
                 "effective_weight": f.effective_weight, "present": f.present}
                for f in engine_result.factors
            ]

            if existing_score:
                existing_score.score = engine_result.score
                existing_score.hrv_ms = health_req.hrv_ms
                existing_score.resting_hr_bpm = health_req.resting_hr_bpm
                existing_score.sleep_duration_hours = health_req.sleep_duration_hours
                existing_score.sleep_quality = checkin_row.sleep_quality if checkin_row else None
                existing_score.soreness = checkin_row.soreness if checkin_row else None
                existing_score.stress = checkin_row.stress if checkin_row else None
                existing_score.factors_json = factors_data
            else:
                existing_score = ReadinessScore(
                    user_id=user_id,
                    score=engine_result.score,
                    score_date=score_date,
                    hrv_ms=health_req.hrv_ms,
                    resting_hr_bpm=health_req.resting_hr_bpm,
                    sleep_duration_hours=health_req.sleep_duration_hours,
                    sleep_quality=checkin_row.sleep_quality if checkin_row else None,
                    soreness=checkin_row.soreness if checkin_row else None,
                    stress=checkin_row.stress if checkin_row else None,
                    factors_json=factors_data,
                )
                self.session.add(existing_score)

            await self.session.commit()
            await self.session.refresh(existing_score)

            logger.info(
                "Readiness score computed: user=%s date=%s score=%s",
                user_id, score_date, engine_result.score,
            )

            return ReadinessScoreResponse(
                id=existing_score.id,
                user_id=existing_score.user_id,
                score=existing_score.score,
                score_date=existing_score.score_date,
                factors=[FactorScoreResponse(**f) for f in existing_score.factors_json],
                factors_present=engine_result.factors_present,
                factors_total=engine_result.factors_total,
                created_at=existing_score.created_at,
            )
        except ApiError:
            raise
        except Exception:
            logger.exception("Failed to compute readiness score for user=%s", user_id)
            raise ApiError(
                status=500, code="INTERNAL_ERROR",
                message="Failed to compute readiness score",
            )

    async def get_history(
        self,
        user_id: uuid.UUID,
        start_date: date,
        end_date: date,
    ) -> ReadinessHistoryResponse:
        """Fetch scores in date range ordered by score_date DESC."""
        if start_date > end_date:
            raise ApiError(
                status=422, code="INVALID_RANGE",
                message="start_date must be before or equal to end_date",
            )

        if (end_date - start_date).days > MAX_HISTORY_DAYS:
            raise ApiError(
                status=422, code="RANGE_TOO_LARGE",
                message=f"Date range must not exceed {MAX_HISTORY_DAYS} days",
            )

        try:
            stmt = select(ReadinessScore).where(
                ReadinessScore.user_id == user_id,
                ReadinessScore.score_date >= start_date,
                ReadinessScore.score_date <= end_date,
            ).order_by(ReadinessScore.score_date.desc())

            result = await self.session.execute(stmt)
            rows = list(result.scalars().all())

            items = [
                ReadinessScoreResponse(
                    id=r.id,
                    user_id=r.user_id,
                    score=r.score,
                    score_date=r.score_date,
                    factors=[FactorScoreResponse(**f) for f in (r.factors_json or [])],
                    factors_present=sum(1 for f in (r.factors_json or []) if f.get("present")),
                    factors_total=6,
                    created_at=r.created_at,
                )
                for r in rows
            ]

            return ReadinessHistoryResponse(
                items=items,
                start_date=start_date,
                end_date=end_date,
            )
        except ApiError:
            raise
        except Exception:
            logger.exception("Failed to fetch readiness history for user=%s", user_id)
            raise ApiError(
                status=500, code="INTERNAL_ERROR",
                message="Failed to fetch readiness history",
            )
