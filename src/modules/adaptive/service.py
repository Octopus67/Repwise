"""Adaptive service — snapshot generation, history, and recalculation checks."""

from __future__ import annotations
from typing import Optional

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.adaptive.engine import AdaptiveInput, compute_snapshot
from src.modules.adaptive.models import AdaptiveSnapshot
from src.modules.adaptive.schemas import (
    RecalculationStatusResponse,
    SnapshotRequest,
    SnapshotResponse,
)
from src.shared.pagination import PaginatedResult, PaginationParams


class AdaptiveService:
    """Handles adaptive snapshot generation, retrieval, and recalculation checks."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def generate_snapshot(
        self, user_id: uuid.UUID, data: SnapshotRequest
    ) -> SnapshotResponse:
        """Compute a new adaptive snapshot and persist it (Requirements 7.1, 7.2)."""
        # Build the pure-function input
        engine_input = AdaptiveInput(
            weight_kg=data.weight_kg,
            height_cm=data.height_cm,
            age_years=data.age_years,
            sex=data.sex,
            activity_level=data.activity_level,
            goal_type=data.goal_type,
            goal_rate_per_week=data.goal_rate_per_week,
            bodyweight_history=[
                (entry.date, entry.weight_kg) for entry in data.bodyweight_history
            ],
            training_load_score=data.training_load_score,
        )

        # Pure computation — no side effects
        output = compute_snapshot(engine_input)

        # Serialise input parameters for storage
        input_params = data.model_dump(mode="json")

        # Persist
        snapshot = AdaptiveSnapshot(
            user_id=user_id,
            target_calories=output.target_calories,
            target_protein_g=output.target_protein_g,
            target_carbs_g=output.target_carbs_g,
            target_fat_g=output.target_fat_g,
            ema_current=output.ema_current,
            adjustment_factor=output.adjustment_factor,
            input_parameters=input_params,
        )
        self.session.add(snapshot)
        await self.session.flush()

        return SnapshotResponse.model_validate(snapshot)

    async def get_snapshots(
        self, user_id: uuid.UUID, pagination: PaginationParams
    ) -> PaginatedResult[SnapshotResponse]:
        """Return paginated snapshot history, newest first (Requirement 7.4)."""
        base = select(AdaptiveSnapshot).where(AdaptiveSnapshot.user_id == user_id)

        count_stmt = select(func.count()).select_from(base.subquery())
        total_count = (await self.session.execute(count_stmt)).scalar_one()

        items_stmt = (
            base.order_by(AdaptiveSnapshot.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        result = await self.session.execute(items_stmt)
        rows = result.scalars().all()

        return PaginatedResult[SnapshotResponse](
            items=[SnapshotResponse.model_validate(r) for r in rows],
            total_count=total_count,
            page=pagination.page,
            limit=pagination.limit,
        )

    async def check_recalculation_needed(
        self,
        user_id: uuid.UUID,
        current_ema: Optional[float] = None,
        current_training_load: Optional[float] = None,
        current_goal_type: Optional[str] = None,
        current_goal_rate: Optional[float] = None,
    ) -> RecalculationStatusResponse:
        """Check whether a recalculation is recommended (Requirement 7.3).

        Triggers (from design doc):
        1. |EMA_current - EMA_at_last_snapshot| > 1.0 kg
        2. |training_load_current - training_load_at_last_snapshot| > 20
        3. days_since_last_snapshot > 7
        4. User changed goal_type or goal_rate
        """
        # Fetch the most recent snapshot
        stmt = (
            select(AdaptiveSnapshot)
            .where(AdaptiveSnapshot.user_id == user_id)
            .order_by(AdaptiveSnapshot.created_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        last_snapshot = result.scalar_one_or_none()

        if last_snapshot is None:
            return RecalculationStatusResponse(
                needs_recalculation=True,
                reasons=["No previous snapshot exists"],
                last_snapshot_at=None,
            )

        reasons: list[str] = []
        now = datetime.now(timezone.utc)

        # Trigger 3: staleness
        days_since = (now - last_snapshot.created_at.replace(tzinfo=timezone.utc)).days
        if days_since > 7:
            reasons.append(f"Last snapshot is {days_since} days old (>7)")

        # Trigger 1: significant weight change
        if current_ema is not None:
            ema_diff = abs(current_ema - last_snapshot.ema_current)
            if ema_diff > 1.0:
                reasons.append(
                    f"EMA changed by {ema_diff:.2f} kg (>1.0)"
                )

        # Trigger 2: significant training load change
        if current_training_load is not None:
            input_params = last_snapshot.input_parameters or {}
            prev_load = input_params.get("training_load_score", 0)
            load_diff = abs(current_training_load - prev_load)
            if load_diff > 20:
                reasons.append(
                    f"Training load changed by {load_diff:.1f} (>20)"
                )

        # Trigger 4: goal change
        if current_goal_type is not None or current_goal_rate is not None:
            input_params = last_snapshot.input_parameters or {}
            if current_goal_type and current_goal_type != input_params.get("goal_type"):
                reasons.append("Goal type changed")
            if current_goal_rate is not None and current_goal_rate != input_params.get(
                "goal_rate_per_week"
            ):
                reasons.append("Goal rate changed")

        return RecalculationStatusResponse(
            needs_recalculation=len(reasons) > 0,
            reasons=reasons,
            last_snapshot_at=last_snapshot.created_at,
        )
