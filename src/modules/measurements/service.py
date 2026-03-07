"""Business logic for body measurements CRUD."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.measurements.models import BodyMeasurement
from src.modules.measurements.schemas import MeasurementCreate, MeasurementUpdate, TrendPoint
from src.shared.errors import NotFoundError
from src.shared.pagination import PaginatedResult, PaginationParams

logger = logging.getLogger(__name__)


class MeasurementService:
    """Service layer for body measurement operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, user_id: uuid.UUID, data: MeasurementCreate) -> BodyMeasurement:
        measurement = BodyMeasurement(
            user_id=user_id,
            **data.model_dump(),
        )
        self.session.add(measurement)
        await self.session.flush()
        return measurement

    async def get(self, user_id: uuid.UUID, measurement_id: uuid.UUID) -> BodyMeasurement:
        stmt = select(BodyMeasurement).where(
            BodyMeasurement.id == measurement_id,
            BodyMeasurement.user_id == user_id,
        )
        result = await self.session.execute(stmt)
        measurement = result.scalar_one_or_none()
        if measurement is None:
            raise NotFoundError("Measurement not found")
        return measurement

    async def get_latest(self, user_id: uuid.UUID) -> BodyMeasurement:
        stmt = (
            select(BodyMeasurement)
            .where(BodyMeasurement.user_id == user_id)
            .order_by(BodyMeasurement.measured_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        measurement = result.scalar_one_or_none()
        if measurement is None:
            raise NotFoundError("No measurements found")
        return measurement

    async def list(self, user_id: uuid.UUID, pagination: PaginationParams) -> PaginatedResult:
        base = select(BodyMeasurement).where(BodyMeasurement.user_id == user_id)

        count_stmt = select(func.count()).select_from(base.subquery())
        total_count = (await self.session.execute(count_stmt)).scalar_one()

        items_stmt = (
            base.order_by(BodyMeasurement.measured_at.desc())
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        rows = (await self.session.execute(items_stmt)).scalars().all()

        from src.modules.measurements.schemas import MeasurementResponse

        return PaginatedResult(
            items=[MeasurementResponse.model_validate(r) for r in rows],
            total_count=total_count,
            page=pagination.page,
            limit=pagination.limit,
        )

    async def update(
        self, user_id: uuid.UUID, measurement_id: uuid.UUID, data: MeasurementUpdate,
    ) -> BodyMeasurement:
        measurement = await self.get(user_id, measurement_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(measurement, field, value)
        await self.session.flush()
        await self.session.refresh(measurement)
        return measurement

    async def delete(self, user_id: uuid.UUID, measurement_id: uuid.UUID) -> None:
        measurement = await self.get(user_id, measurement_id)
        await self.session.delete(measurement)
        await self.session.flush()

    async def get_trend(self, user_id: uuid.UUID, days: int = 90) -> list[TrendPoint]:
        from datetime import timedelta, timezone

        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        stmt = (
            select(BodyMeasurement)
            .where(
                BodyMeasurement.user_id == user_id,
                BodyMeasurement.measured_at >= cutoff,
            )
            .order_by(BodyMeasurement.measured_at.asc())
        )
        result = await self.session.execute(stmt)
        rows = result.scalars().all()
        return [
            TrendPoint(
                measured_at=r.measured_at,
                weight_kg=r.weight_kg,
                body_fat_pct=r.body_fat_pct,
                waist_cm=r.waist_cm,
                neck_cm=r.neck_cm,
                chest_cm=r.chest_cm,
            )
            for r in rows
        ]
