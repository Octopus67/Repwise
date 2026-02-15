"""Landmark Store — CRUD for user volume landmark customizations."""

from __future__ import annotations

import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.training.volume_models import UserVolumeLandmark
from src.modules.training.volume_schemas import VolumeLandmark
from src.modules.training.volume_service import DEFAULT_LANDMARKS
from src.shared.errors import UnprocessableError


class LandmarkStore:
    """Manages default and user-customized volume landmarks."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_landmarks(self, user_id: uuid.UUID) -> dict[str, VolumeLandmark]:
        """Return merged landmarks: defaults overridden by user customizations."""
        stmt = select(UserVolumeLandmark).where(UserVolumeLandmark.user_id == user_id)
        result = await self.session.execute(stmt)
        custom_rows = {row.muscle_group: row for row in result.scalars()}

        merged: dict[str, VolumeLandmark] = {}
        for mg, (mev, mav, mrv) in DEFAULT_LANDMARKS.items():
            if mg in custom_rows:
                row = custom_rows[mg]
                merged[mg] = VolumeLandmark(
                    muscle_group=mg, mev=row.mev, mav=row.mav, mrv=row.mrv, is_custom=True
                )
            else:
                merged[mg] = VolumeLandmark(
                    muscle_group=mg, mev=mev, mav=mav, mrv=mrv, is_custom=False
                )
        return merged

    async def set_landmark(
        self, user_id: uuid.UUID, muscle_group: str, mev: int, mav: int, mrv: int
    ) -> VolumeLandmark:
        """Upsert a custom landmark. Validates MEV < MAV < MRV and all >= 0."""
        if mev < 0 or mav < 0 or mrv < 0:
            raise UnprocessableError("Landmark values must be non-negative")
        if not (mev < mav < mrv):
            raise UnprocessableError("Landmarks must satisfy MEV < MAV < MRV")

        stmt = select(UserVolumeLandmark).where(
            UserVolumeLandmark.user_id == user_id,
            UserVolumeLandmark.muscle_group == muscle_group,
        )
        result = await self.session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            existing.mev = mev
            existing.mav = mav
            existing.mrv = mrv
        else:
            row = UserVolumeLandmark(
                user_id=user_id, muscle_group=muscle_group, mev=mev, mav=mav, mrv=mrv
            )
            self.session.add(row)

        await self.session.flush()
        return VolumeLandmark(
            muscle_group=muscle_group, mev=mev, mav=mav, mrv=mrv, is_custom=True
        )

    async def delete_landmark(self, user_id: uuid.UUID, muscle_group: str) -> None:
        """Delete a user's custom landmark, reverting to defaults."""
        stmt = delete(UserVolumeLandmark).where(
            UserVolumeLandmark.user_id == user_id,
            UserVolumeLandmark.muscle_group == muscle_group,
        )
        await self.session.execute(stmt)
        await self.session.flush()
