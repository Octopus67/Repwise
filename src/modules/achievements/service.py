"""Achievement Service — read operations for achievement state."""

from __future__ import annotations
from typing import Optional

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.achievements.definitions import (
    ACHIEVEMENT_REGISTRY,
    AchievementCategory,
    AchievementDef,
)
from src.modules.achievements.models import AchievementProgress, UserAchievement
from src.modules.achievements.schemas import (
    AchievementDefResponse,
    AchievementWithStatus,
    StreakResponse,
    UserAchievementResponse,
)
from src.shared.pagination import PaginatedResult, PaginationParams


class AchievementService:
    """Read-only service for querying achievement state."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_all_achievements(
        self, user_id: uuid.UUID
    ) -> list[AchievementWithStatus]:
        """Return all achievement definitions with the user's unlock/progress state."""
        # Batch-load all unlocked achievements for this user
        ua_stmt = select(UserAchievement).where(
            UserAchievement.user_id == user_id,
            UserAchievement.deleted_at.is_(None),
        )
        ua_result = await self.session.execute(ua_stmt)
        unlocked_map: dict[str, UserAchievement] = {
            ua.achievement_id: ua for ua in ua_result.scalars().all()
        }

        # Batch-load all progress records
        prog_stmt = select(AchievementProgress).where(
            AchievementProgress.user_id == user_id,
        )
        prog_result = await self.session.execute(prog_stmt)
        progress_map: dict[str, AchievementProgress] = {
            p.progress_type: p for p in prog_result.scalars().all()
        }

        items: list[AchievementWithStatus] = []
        # Sort by category then threshold for consistent ordering
        sorted_defs = sorted(
            ACHIEVEMENT_REGISTRY.values(),
            key=lambda d: (d.category, d.threshold),
        )

        for defn in sorted_defs:
            ua = unlocked_map.get(defn.id)
            progress_frac: Optional[float] = None
            current_val: Optional[float] = None

            if ua is None:
                # Locked — compute progress fraction
                current_val, progress_frac = self._compute_progress(defn, progress_map)

            items.append(
                AchievementWithStatus(
                    definition=AchievementDefResponse(
                        id=defn.id,
                        category=defn.category,
                        title=defn.title,
                        description=defn.description,
                        icon=defn.icon,
                        threshold=defn.threshold,
                    ),
                    unlocked=ua is not None,
                    unlocked_at=ua.unlocked_at if ua else None,
                    progress=progress_frac,
                    current_value=current_val,
                )
            )

        return items

    async def get_unlocked_achievements(
        self, user_id: uuid.UUID, pagination: PaginationParams
    ) -> PaginatedResult[UserAchievementResponse]:
        """Return only the user's unlocked achievements, paginated."""
        from sqlalchemy import func

        base = select(UserAchievement).where(
            UserAchievement.user_id == user_id,
            UserAchievement.deleted_at.is_(None),
        )

        count_stmt = select(func.count()).select_from(base.subquery())
        total = (await self.session.execute(count_stmt)).scalar_one()

        items_stmt = (
            base.order_by(UserAchievement.unlocked_at.desc())
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        result = await self.session.execute(items_stmt)
        rows = result.scalars().all()

        responses: list[UserAchievementResponse] = []
        for ua in rows:
            defn = ACHIEVEMENT_REGISTRY.get(ua.achievement_id)
            if defn is None:
                continue
            responses.append(
                UserAchievementResponse(
                    achievement_id=ua.achievement_id,
                    title=defn.title,
                    description=defn.description,
                    icon=defn.icon,
                    category=defn.category,
                    unlocked_at=ua.unlocked_at,
                    trigger_data=ua.trigger_data,
                )
            )

        return PaginatedResult[UserAchievementResponse](
            items=responses,
            total_count=total,
            page=pagination.page,
            limit=pagination.limit,
        )

    async def get_streak(self, user_id: uuid.UUID) -> StreakResponse:
        """Return the user's current and longest streak."""
        stmt = select(AchievementProgress).where(
            AchievementProgress.user_id == user_id,
            AchievementProgress.progress_type == "streak",
        )
        result = await self.session.execute(stmt)
        progress = result.scalar_one_or_none()

        if progress is None:
            return StreakResponse(current_streak=0, longest_streak=0)

        meta = progress.metadata_ or {}
        current = progress.current_value
        # Guard against NaN / None values
        try:
            current_int = max(0, int(current)) if current is not None else 0
        except (TypeError, ValueError):
            current_int = 0
        try:
            longest_int = max(0, int(meta.get("longest_streak", current_int)))
        except (TypeError, ValueError):
            longest_int = current_int
        return StreakResponse(
            current_streak=current_int,
            longest_streak=longest_int,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_progress(
        defn: AchievementDef,
        progress_map: dict[str, AchievementProgress],
    ) -> tuple[Optional[float], Optional[float]]:
        """Return (current_value, fraction) for a locked achievement."""
        if defn.category == AchievementCategory.STREAK:
            p = progress_map.get("streak")
        elif defn.category == AchievementCategory.VOLUME:
            p = progress_map.get("lifetime_volume")
        elif defn.category == AchievementCategory.NUTRITION:
            p = progress_map.get("nutrition_compliance")
        else:
            # PR badges don't have incremental progress
            return None, None

        if p is None:
            return 0.0, 0.0

        current = p.current_value
        frac = min(current / defn.threshold, 1.0) if defn.threshold > 0 else 0.0
        return current, frac
