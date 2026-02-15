"""Periodization service — CRUD for training blocks with overlap detection."""

from __future__ import annotations
from typing import Optional

import logging
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.periodization.models import TrainingBlock
from src.modules.periodization.schemas import (
    DeloadSuggestion,
    TrainingBlockCreate,
    TrainingBlockResponse,
    TrainingBlockUpdate,
)
from src.modules.periodization.templates import expand_template, get_template_by_id
from src.shared.errors import ConflictError, NotFoundError, ValidationError
from src.shared.types import AuditAction

logger = logging.getLogger(__name__)


class PeriodizationService:
    """Handles training block CRUD, overlap detection, template application, and deload suggestions."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_block(
        self, user_id: uuid.UUID, data: TrainingBlockCreate
    ) -> TrainingBlockResponse:
        """Create a new training block after checking for overlaps."""
        logger.info("Creating training block '%s' for user %s", data.name, user_id)
        await self._check_overlap(user_id, data.start_date, data.end_date)

        block = TrainingBlock(
            user_id=user_id,
            name=data.name,
            phase_type=data.phase_type,
            start_date=data.start_date,
            end_date=data.end_date,
            nutrition_phase=data.nutrition_phase,
        )
        self.session.add(block)
        await self.session.flush()

        await TrainingBlock.write_audit(
            self.session,
            user_id=user_id,
            action=AuditAction.CREATE,
            entity_id=block.id,
        )

        return TrainingBlockResponse.from_orm_model(block)

    async def list_blocks(
        self,
        user_id: uuid.UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> list[TrainingBlockResponse]:
        """Return non-deleted blocks for user, ordered by start_date ASC."""
        stmt = select(TrainingBlock).where(TrainingBlock.user_id == user_id)
        stmt = TrainingBlock.not_deleted(stmt)

        if start_date is not None:
            stmt = stmt.where(TrainingBlock.end_date >= start_date)
        if end_date is not None:
            stmt = stmt.where(TrainingBlock.start_date <= end_date)

        stmt = stmt.order_by(TrainingBlock.start_date.asc())
        result = await self.session.execute(stmt)
        rows = result.scalars().all()
        return [TrainingBlockResponse.from_orm_model(r) for r in rows]

    async def get_block(
        self, user_id: uuid.UUID, block_id: uuid.UUID
    ) -> TrainingBlockResponse:
        """Return a single block or raise NotFoundError."""
        block = await self._get_or_404(user_id, block_id)
        return TrainingBlockResponse.from_orm_model(block)

    async def update_block(
        self,
        user_id: uuid.UUID,
        block_id: uuid.UUID,
        data: TrainingBlockUpdate,
    ) -> TrainingBlockResponse:
        """Update a training block with overlap check if dates changed."""
        logger.info("Updating training block %s for user %s", block_id, user_id)
        block = await self._get_or_404(user_id, block_id)

        changes: dict[str, dict] = {}
        update_data = data.model_dump(exclude_unset=True)

        for field, new_value in update_data.items():
            old_value = getattr(block, field)
            if old_value != new_value:
                changes[field] = {"old": str(old_value), "new": str(new_value)}
                setattr(block, field, new_value)

        # Check overlap if dates changed
        new_start = block.start_date
        new_end = block.end_date
        if "start_date" in update_data or "end_date" in update_data:
            # Validate date range after applying updates
            if new_end < new_start:
                raise ValidationError("end_date must be on or after start_date")
            await self._check_overlap(user_id, new_start, new_end, exclude_id=block_id)

        if changes:
            await TrainingBlock.write_audit(
                self.session,
                user_id=user_id,
                action=AuditAction.UPDATE,
                entity_id=block_id,
                changes=changes,
            )

        await self.session.flush()
        return TrainingBlockResponse.from_orm_model(block)

    async def soft_delete_block(
        self, user_id: uuid.UUID, block_id: uuid.UUID
    ) -> None:
        """Soft-delete a training block."""
        logger.info("Soft-deleting training block %s for user %s", block_id, user_id)
        block = await self._get_or_404(user_id, block_id)
        block.deleted_at = datetime.now(timezone.utc)

        await TrainingBlock.write_audit(
            self.session,
            user_id=user_id,
            action=AuditAction.DELETE,
            entity_id=block_id,
        )
        await self.session.flush()

    async def apply_template(
        self,
        user_id: uuid.UUID,
        template_id: str,
        start_date: date,
    ) -> list[TrainingBlockResponse]:
        """Expand and apply a block template, creating all blocks atomically."""
        logger.info("Applying template '%s' for user %s starting %s", template_id, user_id, start_date)
        template = get_template_by_id(template_id)
        if template is None:
            raise NotFoundError("Block template not found")

        expanded = expand_template(template_id, start_date)
        if not expanded:
            raise NotFoundError("Block template not found")

        # Check overlap for the entire expanded range at once
        full_start = expanded[0]["start_date"]
        full_end = expanded[-1]["end_date"]
        await self._check_overlap(user_id, full_start, full_end)

        created: list[TrainingBlockResponse] = []
        for block_data in expanded:
            block = TrainingBlock(
                user_id=user_id,
                name=block_data["name"],
                phase_type=block_data["phase_type"],
                start_date=block_data["start_date"],
                end_date=block_data["end_date"],
            )
            self.session.add(block)
            await self.session.flush()
            created.append(TrainingBlockResponse.from_orm_model(block))

        return created

    async def check_deload_suggestions(
        self, user_id: uuid.UUID
    ) -> list[DeloadSuggestion]:
        """Check for consecutive non-deload blocks > 4 weeks and suggest deloads."""
        stmt = (
            select(TrainingBlock)
            .where(TrainingBlock.user_id == user_id)
            .order_by(TrainingBlock.start_date.asc())
        )
        stmt = TrainingBlock.not_deleted(stmt)
        result = await self.session.execute(stmt)
        blocks = result.scalars().all()

        suggestions: list[DeloadSuggestion] = []
        consecutive_start: Optional[date] = None
        consecutive_end: Optional[date] = None

        for block in blocks:
            if block.phase_type == "deload":
                # Reset consecutive tracking
                consecutive_start = None
                consecutive_end = None
                continue

            if consecutive_start is None:
                consecutive_start = block.start_date
                consecutive_end = block.end_date
            else:
                consecutive_end = block.end_date

            # Calculate consecutive weeks
            total_days = (consecutive_end - consecutive_start).days + 1
            consecutive_weeks = total_days / 7

            if consecutive_weeks > 4:
                suggested_start = consecutive_end + timedelta(days=1)
                suggestions.append(
                    DeloadSuggestion(
                        message=f"You have {int(consecutive_weeks)} consecutive non-deload weeks. Consider adding a deload week.",
                        suggested_start_date=suggested_start,
                        consecutive_weeks=int(consecutive_weeks),
                    )
                )

        return suggestions

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_or_404(
        self, user_id: uuid.UUID, block_id: uuid.UUID
    ) -> TrainingBlock:
        """Fetch a non-deleted training block or raise NotFoundError."""
        stmt = select(TrainingBlock).where(
            TrainingBlock.id == block_id,
            TrainingBlock.user_id == user_id,
        )
        stmt = TrainingBlock.not_deleted(stmt)
        result = await self.session.execute(stmt)
        block = result.scalar_one_or_none()
        if block is None:
            raise NotFoundError("Training block not found")
        return block

    async def _check_overlap(
        self,
        user_id: uuid.UUID,
        start_date: date,
        end_date: date,
        exclude_id: Optional[uuid.UUID] = None,
    ) -> None:
        """Raise ConflictError if any existing block overlaps the given range."""
        stmt = select(TrainingBlock.id).where(
            TrainingBlock.user_id == user_id,
            TrainingBlock.start_date <= end_date,
            TrainingBlock.end_date >= start_date,
        )
        stmt = TrainingBlock.not_deleted(stmt)

        if exclude_id is not None:
            stmt = stmt.where(TrainingBlock.id != exclude_id)

        result = await self.session.execute(stmt)
        if result.scalar_one_or_none() is not None:
            raise ConflictError("Training block overlaps with existing block")
