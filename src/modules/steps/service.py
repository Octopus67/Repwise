"""Business logic for daily step tracking."""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.steps.models import DailyStep
from src.modules.steps.schemas import SyncStepsRequest

logger = logging.getLogger(__name__)


class StepsService:
    """Service layer for daily step operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def sync_steps(self, user_id: uuid.UUID, data: SyncStepsRequest) -> DailyStep:
        """Upsert a daily step entry.

        Uses INSERT ... ON CONFLICT DO UPDATE to atomically create or update
        the step count for a given (user_id, date) pair.
        """
        parsed_date = date.fromisoformat(data.date)

        stmt = (
            pg_insert(DailyStep)
            .values(
                user_id=user_id,
                date=parsed_date,
                step_count=data.step_count,
                step_goal=data.step_goal,
            )
            .on_conflict_do_update(
                constraint="uq_daily_steps_user_date",
                set_={
                    "step_count": data.step_count,
                    "step_goal": data.step_goal,
                    "updated_at": datetime.now(timezone.utc),
                },
            )
            .returning(DailyStep)
        )

        result = await self.session.execute(stmt)
        row = result.scalar_one()
        await self.session.flush()
        logger.info(
            "Synced steps for user=%s date=%s count=%d", user_id, data.date, data.step_count
        )
        return row

    async def get_history(
        self,
        user_id: uuid.UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: int = 30,
    ) -> list[DailyStep]:
        """Fetch step history for a user, ordered by most recent first."""
        stmt = select(DailyStep).where(DailyStep.user_id == user_id)

        if start_date:
            stmt = stmt.where(DailyStep.date >= start_date)
        if end_date:
            stmt = stmt.where(DailyStep.date <= end_date)

        stmt = stmt.order_by(DailyStep.date.desc()).limit(limit)

        result = await self.session.execute(stmt)
        return list(result.scalars().all())
