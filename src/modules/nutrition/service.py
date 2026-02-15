"""Business logic for nutrition entry CRUD operations."""

from __future__ import annotations
from typing import Optional

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.nutrition.models import NutritionEntry
from src.modules.nutrition.schemas import (
    BatchEntryCreate,
    DateRangeFilter,
    NutritionEntryCreate,
    NutritionEntryUpdate,
)
from src.shared.errors import NotFoundError
from src.shared.pagination import PaginatedResult, PaginationParams
from src.shared.types import AuditAction

logger = logging.getLogger(__name__)


class NutritionService:
    """Service layer for nutrition entry operations.

    All methods scope queries to the given ``user_id`` so users can only
    access their own data.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_entry(
        self,
        user_id: uuid.UUID,
        data: NutritionEntryCreate,
    ) -> NutritionEntry:
        """Persist a new nutrition entry (Requirement 3.1)."""
        entry = NutritionEntry(
            user_id=user_id,
            meal_name=data.meal_name,
            calories=data.calories,
            protein_g=data.protein_g,
            carbs_g=data.carbs_g,
            fat_g=data.fat_g,
            micro_nutrients=data.micro_nutrients,
            entry_date=data.entry_date,
            source_meal_id=data.source_meal_id,
        )
        self.session.add(entry)
        await self.session.flush()

        # --- Achievement evaluation (never breaks entry creation) ---
        newly_unlocked: list = []
        try:
            from src.modules.achievements.engine import AchievementEngine

            engine = AchievementEngine(self.session)
            newly_unlocked = await engine.evaluate_nutrition_entry(
                user_id=user_id,
                entry_date=data.entry_date,
            )
        except Exception:
            logger.exception("Achievement evaluation failed for nutrition entry")

        # Attach unlocks to the entry object for the router to pick up
        entry._newly_unlocked = newly_unlocked  # type: ignore[attr-defined]
        return entry

    async def get_entries(
        self,
        user_id: uuid.UUID,
        filters: Optional[DateRangeFilter] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> PaginatedResult[NutritionEntry]:
        """Return paginated nutrition entries, optionally filtered by date range (Requirement 3.2)."""
        pagination = pagination or PaginationParams()

        base = select(NutritionEntry).where(NutritionEntry.user_id == user_id)
        base = NutritionEntry.not_deleted(base)

        if filters:
            base = base.where(NutritionEntry.entry_date >= filters.start_date)
            base = base.where(NutritionEntry.entry_date <= filters.end_date)

        # Total count
        count_stmt = select(func.count()).select_from(base.subquery())
        total_count = (await self.session.execute(count_stmt)).scalar_one()

        # Paginated results ordered by entry_date descending
        items_stmt = (
            base.order_by(NutritionEntry.entry_date.desc(), NutritionEntry.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        result = await self.session.execute(items_stmt)
        items = list(result.scalars().all())

        return PaginatedResult[NutritionEntry](
            items=items,
            total_count=total_count,
            page=pagination.page,
            limit=pagination.limit,
        )

    async def update_entry(
        self,
        user_id: uuid.UUID,
        entry_id: uuid.UUID,
        data: NutritionEntryUpdate,
    ) -> NutritionEntry:
        """Update an existing entry and write an audit trail (Requirement 3.3)."""
        entry = await self._get_entry_or_raise(user_id, entry_id)

        # Capture old values for audit
        old_values: dict = {}
        new_values: dict = {}
        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            old_val = getattr(entry, field)
            if old_val != value:
                old_values[field] = old_val
                new_values[field] = value
                setattr(entry, field, value)

        if old_values:
            await NutritionEntry.write_audit(
                self.session,
                user_id=user_id,
                action=AuditAction.UPDATE,
                entity_id=entry_id,
                changes={"old": old_values, "new": new_values},
            )

        await self.session.flush()
        return entry

    async def soft_delete_entry(
        self,
        user_id: uuid.UUID,
        entry_id: uuid.UUID,
    ) -> None:
        """Soft-delete an entry so it remains recoverable (Requirement 3.4)."""
        entry = await self._get_entry_or_raise(user_id, entry_id)
        entry.deleted_at = datetime.now(timezone.utc)

        await NutritionEntry.write_audit(
            self.session,
            user_id=user_id,
            action=AuditAction.DELETE,
            entity_id=entry_id,
            changes={},
        )
        await self.session.flush()

    # ------------------------------------------------------------------
    # Batch creation (Meal Builder)
    # ------------------------------------------------------------------

    async def create_entries_batch(
        self,
        user_id: uuid.UUID,
        data: BatchEntryCreate,
    ) -> list[NutritionEntry]:
        """Atomically create multiple nutrition entries with the same meal_name and entry_date.

        All-or-nothing: if any entry fails validation, none are persisted.
        Used by the Meal Builder feature (Requirement 6.1.6).
        """
        created: list[NutritionEntry] = []
        for item in data.entries:
            entry = NutritionEntry(
                user_id=user_id,
                meal_name=data.meal_name,
                calories=item.calories,
                protein_g=item.protein_g,
                carbs_g=item.carbs_g,
                fat_g=item.fat_g,
                micro_nutrients=item.micro_nutrients,
                entry_date=data.entry_date,
                source_meal_id=item.source_meal_id,
            )
            self.session.add(entry)
            created.append(entry)
        await self.session.flush()

        # After flush, evaluate achievements once for the batch
        newly_unlocked: list = []
        try:
            from src.modules.achievements.engine import AchievementEngine
            engine = AchievementEngine(self.session)
            newly_unlocked = await engine.evaluate_nutrition_entry(
                user_id=user_id,
                entry_date=data.entry_date,
            )
        except Exception:
            logger.exception("Achievement evaluation failed for batch nutrition entry")

        # Attach to first entry for router to pick up
        if created and newly_unlocked:
            created[0]._newly_unlocked = newly_unlocked  # type: ignore[attr-defined]

        return created

    # ------------------------------------------------------------------
    # Copy entries
    # ------------------------------------------------------------------

    async def copy_entries_from_date(
        self,
        user_id: uuid.UUID,
        source_date: "date",
        target_date: "date",
    ) -> list[NutritionEntry]:
        """Duplicate all non-deleted entries from source_date to target_date."""
        from datetime import date as date_type
        source_entries = await self.get_entries(
            user_id=user_id,
            filters=DateRangeFilter(start_date=source_date, end_date=source_date),
            pagination=PaginationParams(page=1, limit=100),
        )

        copied: list[NutritionEntry] = []
        for entry in source_entries.items:
            new_entry = NutritionEntry(
                user_id=user_id,
                meal_name=entry.meal_name,
                calories=entry.calories,
                protein_g=entry.protein_g,
                carbs_g=entry.carbs_g,
                fat_g=entry.fat_g,
                micro_nutrients=entry.micro_nutrients,
                entry_date=target_date,
            )
            self.session.add(new_entry)
            copied.append(new_entry)

        await self.session.flush()
        return copied

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_entry_or_raise(
        self,
        user_id: uuid.UUID,
        entry_id: uuid.UUID,
    ) -> NutritionEntry:
        """Fetch a non-deleted entry owned by the user, or raise NotFoundError."""
        stmt = (
            select(NutritionEntry)
            .where(NutritionEntry.id == entry_id)
            .where(NutritionEntry.user_id == user_id)
        )
        stmt = NutritionEntry.not_deleted(stmt)
        result = await self.session.execute(stmt)
        entry = result.scalar_one_or_none()
        if entry is None:
            raise NotFoundError("Nutrition entry not found")
        return entry
