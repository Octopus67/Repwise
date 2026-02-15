"""Business logic for progress photo metadata CRUD operations."""

from __future__ import annotations
from typing import Optional

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.progress_photos.models import ProgressPhoto
from src.modules.progress_photos.schemas import PhotoCreate, PhotoUpdate
from src.modules.user.models import BodyweightLog
from src.shared.errors import NotFoundError
from src.shared.pagination import PaginatedResult, PaginationParams

logger = logging.getLogger(__name__)


class ProgressPhotoService:
    """Service layer for progress photo metadata operations.

    All methods scope queries to the given ``user_id`` so users can only
    access their own data.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_photo(
        self,
        user_id: uuid.UUID,
        data: PhotoCreate,
    ) -> ProgressPhoto:
        """Create progress photo metadata.

        If bodyweight_kg is not provided, auto-fill from the user's most
        recent BodyweightLog entry.
        """
        bodyweight = data.bodyweight_kg
        if bodyweight is None:
            bodyweight = await self._get_latest_bodyweight(user_id)
            if bodyweight is not None:
                logger.debug(
                    "Auto-filled bodyweight_kg=%.1f for user %s",
                    bodyweight,
                    user_id,
                )

        photo = ProgressPhoto(
            user_id=user_id,
            capture_date=data.capture_date,
            bodyweight_kg=bodyweight,
            pose_type=data.pose_type,
            notes=data.notes,
            alignment_data=data.alignment_data.model_dump() if data.alignment_data else None,
        )
        self.session.add(photo)
        await self.session.flush()
        logger.info(
            "Created progress photo %s for user %s (date=%s, pose=%s)",
            photo.id,
            user_id,
            data.capture_date,
            data.pose_type,
        )
        return photo

    async def list_photos(
        self,
        user_id: uuid.UUID,
        pagination: PaginationParams,
        pose_type: Optional[str] = None,
    ) -> PaginatedResult[ProgressPhoto]:
        """List photos ordered by capture_date ASC (chronological timeline)."""
        base = select(ProgressPhoto).where(ProgressPhoto.user_id == user_id)
        base = ProgressPhoto.not_deleted(base)

        if pose_type is not None:
            base = base.where(ProgressPhoto.pose_type == pose_type)

        count_stmt = select(func.count()).select_from(base.subquery())
        total_count = (await self.session.execute(count_stmt)).scalar_one()

        items_stmt = (
            base.order_by(
                ProgressPhoto.capture_date.asc(),
                ProgressPhoto.created_at.asc(),
            )
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        result = await self.session.execute(items_stmt)
        items = list(result.scalars().all())

        logger.debug(
            "Listed %d/%d photos for user %s (page=%d, pose_type=%s)",
            len(items),
            total_count,
            user_id,
            pagination.page,
            pose_type,
        )
        return PaginatedResult[ProgressPhoto](
            items=items,
            total_count=total_count,
            page=pagination.page,
            limit=pagination.limit,
        )

    async def get_photo(
        self,
        user_id: uuid.UUID,
        photo_id: uuid.UUID,
    ) -> ProgressPhoto:
        """Fetch a single non-deleted photo owned by the user."""
        stmt = (
            select(ProgressPhoto)
            .where(ProgressPhoto.id == photo_id)
            .where(ProgressPhoto.user_id == user_id)
        )
        stmt = ProgressPhoto.not_deleted(stmt)
        result = await self.session.execute(stmt)
        photo = result.scalar_one_or_none()
        if photo is None:
            logger.warning(
                "Photo %s not found for user %s",
                photo_id,
                user_id,
            )
            raise NotFoundError("Progress photo not found")
        return photo

    async def delete_photo(
        self,
        user_id: uuid.UUID,
        photo_id: uuid.UUID,
    ) -> None:
        """Soft-delete a progress photo."""
        photo = await self.get_photo(user_id, photo_id)
        photo.deleted_at = datetime.now(timezone.utc)
        await self.session.flush()
        logger.info("Soft-deleted photo %s for user %s", photo_id, user_id)

    async def update_photo(
        self,
        user_id: uuid.UUID,
        photo_id: uuid.UUID,
        data: PhotoUpdate,
    ) -> ProgressPhoto:
        """Update a progress photo's mutable fields."""
        photo = await self.get_photo(user_id, photo_id)
        updated_fields = []
        if data.alignment_data is not None:
            photo.alignment_data = data.alignment_data.model_dump()
            updated_fields.append("alignment_data")
        if data.notes is not None:
            photo.notes = data.notes
            updated_fields.append("notes")
        if data.bodyweight_kg is not None:
            photo.bodyweight_kg = data.bodyweight_kg
            updated_fields.append("bodyweight_kg")
        await self.session.flush()
        logger.info(
            "Updated photo %s fields=%s for user %s",
            photo_id,
            updated_fields,
            user_id,
        )
        return photo

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_latest_bodyweight(self, user_id: uuid.UUID) -> Optional[float]:
        """Fetch the most recent bodyweight log entry for the user."""
        stmt = (
            select(BodyweightLog.weight_kg)
            .where(BodyweightLog.user_id == user_id)
            .order_by(BodyweightLog.recorded_date.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        row = result.scalar_one_or_none()
        return row
