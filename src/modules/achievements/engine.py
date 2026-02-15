"""Achievement Engine — evaluates unlock conditions after training/nutrition writes.

The engine is invoked as a side-effect within the Training and Nutrition
service methods.  All public methods are wrapped in try/except so that
achievement failures never break the parent transaction.
"""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.achievements.definitions import (
    ACHIEVEMENT_REGISTRY,
    AchievementCategory,
)
from src.modules.achievements.exercise_aliases import resolve_exercise_group
from src.modules.achievements.models import AchievementProgress, UserAchievement
from src.modules.achievements.schemas import NewlyUnlockedResponse

logger = logging.getLogger(__name__)


class AchievementEngine:
    """Core evaluation logic for the achievement system."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ------------------------------------------------------------------
    # Public orchestrators
    # ------------------------------------------------------------------

    async def evaluate_training_session(
        self,
        user_id: uuid.UUID,
        exercises: list[dict[str, Any]],
        session_date: Optional[date] = None,
    ) -> list[NewlyUnlockedResponse]:
        """Evaluate achievements after a training session is saved.

        Returns a list of newly unlocked achievements.  Never raises —
        logs errors and returns an empty list on failure.
        """
        try:
            unlocked: list[NewlyUnlockedResponse] = []
            unlocked.extend(await self._check_pr_badges(user_id, exercises))
            unlocked.extend(await self._update_volume(user_id, exercises))
            if session_date is not None:
                unlocked.extend(await self._update_streak(user_id, session_date))
            return unlocked
        except Exception:
            logger.exception("Achievement engine failed for training session (user=%s)", user_id)
            return []

    async def evaluate_nutrition_entry(
        self,
        user_id: uuid.UUID,
        entry_date: date,
    ) -> list[NewlyUnlockedResponse]:
        """Evaluate achievements after a nutrition entry is saved.

        Returns a list of newly unlocked achievements.  Never raises.
        """
        try:
            unlocked: list[NewlyUnlockedResponse] = []
            unlocked.extend(await self._update_streak(user_id, entry_date))
            unlocked.extend(await self._check_nutrition_compliance(user_id, entry_date))
            return unlocked
        except Exception:
            logger.exception("Achievement engine failed for nutrition entry (user=%s)", user_id)
            return []

    # ------------------------------------------------------------------
    # PR Badge Detection
    # ------------------------------------------------------------------

    async def _check_pr_badges(
        self,
        user_id: uuid.UUID,
        exercises: list[dict[str, Any]],
    ) -> list[NewlyUnlockedResponse]:
        unlocked: list[NewlyUnlockedResponse] = []

        # Pre-load already-unlocked PR badge IDs for this user
        existing = await self._get_unlocked_ids(user_id, AchievementCategory.PR_BADGE)

        for exercise in exercises:
            exercise_name = exercise.get("exercise_name", "")
            if not isinstance(exercise_name, str) or not exercise_name.strip():
                continue
            group = resolve_exercise_group(exercise_name)
            if group is None:
                continue

            max_weight = 0.0
            for s in exercise.get("sets", []):
                w = s.get("weight_kg", 0)
                try:
                    w = float(w)
                except (TypeError, ValueError):
                    continue
                if w > max_weight:
                    max_weight = w

            if max_weight <= 0:
                continue

            # Check each PR badge for this exercise group
            for defn in ACHIEVEMENT_REGISTRY.values():
                if defn.category != AchievementCategory.PR_BADGE:
                    continue
                if defn.exercise_group != group:
                    continue
                if defn.id in existing:
                    continue
                if max_weight >= defn.threshold:
                    result = await self._try_unlock(
                        user_id,
                        defn.id,
                        trigger_data={
                            "exercise_name": exercise_name,
                            "weight_kg": max_weight,
                        },
                    )
                    if result is not None:
                        unlocked.append(result)
                        existing.add(defn.id)

        return unlocked

    # ------------------------------------------------------------------
    # Volume Tracking
    # ------------------------------------------------------------------

    async def _update_volume(
        self,
        user_id: uuid.UUID,
        exercises: list[dict[str, Any]],
    ) -> list[NewlyUnlockedResponse]:
        # Calculate session volume with input validation
        session_volume = 0.0
        for exercise in exercises:
            for s in exercise.get("sets", []):
                try:
                    weight = float(s.get("weight_kg", 0))
                    reps = float(s.get("reps", 0))
                except (TypeError, ValueError):
                    continue
                if weight < 0 or reps < 0:
                    continue
                session_volume += weight * reps

        if session_volume <= 0:
            return []

        # Upsert progress
        progress = await self._get_or_create_progress(user_id, "lifetime_volume")
        progress.current_value += session_volume
        await self.session.flush()

        # Check volume milestones
        unlocked: list[NewlyUnlockedResponse] = []
        existing = await self._get_unlocked_ids(user_id, AchievementCategory.VOLUME)

        for defn in ACHIEVEMENT_REGISTRY.values():
            if defn.category != AchievementCategory.VOLUME:
                continue
            if defn.id in existing:
                continue
            if progress.current_value >= defn.threshold:
                result = await self._try_unlock(
                    user_id,
                    defn.id,
                    trigger_data={"lifetime_volume": progress.current_value},
                )
                if result is not None:
                    unlocked.append(result)
                    existing.add(defn.id)

        return unlocked

    # ------------------------------------------------------------------
    # Streak Tracking
    # ------------------------------------------------------------------

    async def _update_streak(
        self,
        user_id: uuid.UUID,
        activity_date: date,
    ) -> list[NewlyUnlockedResponse]:
        # Guard against future dates
        today = date.today()
        if activity_date > today:
            logger.warning("Ignoring future activity_date %s for user %s", activity_date, user_id)
            return []

        progress = await self._get_or_create_progress(user_id, "streak")
        meta = progress.metadata_ or {}
        last_active_str = meta.get("last_active_date")

        activity_str = activity_date.isoformat()

        if last_active_str == activity_str:
            # Same day — no-op
            return []

        if last_active_str is not None:
            last_active = date.fromisoformat(last_active_str)
            if activity_date == last_active + timedelta(days=1):
                progress.current_value += 1
            else:
                progress.current_value = 1
        else:
            progress.current_value = 1

        # Track longest streak
        longest = meta.get("longest_streak", 0)
        if progress.current_value > longest:
            longest = int(progress.current_value)

        progress.metadata_ = {
            "last_active_date": activity_str,
            "longest_streak": longest,
        }
        await self.session.flush()

        # Check streak thresholds
        unlocked: list[NewlyUnlockedResponse] = []
        existing = await self._get_unlocked_ids(user_id, AchievementCategory.STREAK)

        for defn in ACHIEVEMENT_REGISTRY.values():
            if defn.category != AchievementCategory.STREAK:
                continue
            if defn.id in existing:
                continue
            if progress.current_value >= defn.threshold:
                result = await self._try_unlock(user_id, defn.id)
                if result is not None:
                    unlocked.append(result)
                    existing.add(defn.id)

        return unlocked

    # ------------------------------------------------------------------
    # Nutrition Compliance
    # ------------------------------------------------------------------

    async def _check_nutrition_compliance(
        self,
        user_id: uuid.UUID,
        entry_date: date,
    ) -> list[NewlyUnlockedResponse]:
        # Import here to avoid circular imports
        from src.modules.nutrition.models import NutritionEntry
        from src.modules.adaptive.models import AdaptiveSnapshot

        # Sum day's nutrition totals
        stmt = (
            select(
                func.sum(NutritionEntry.calories).label("total_cal"),
                func.sum(NutritionEntry.protein_g).label("total_pro"),
                func.sum(NutritionEntry.carbs_g).label("total_carb"),
                func.sum(NutritionEntry.fat_g).label("total_fat"),
            )
            .where(
                NutritionEntry.user_id == user_id,
                NutritionEntry.entry_date == entry_date,
                NutritionEntry.deleted_at.is_(None),
            )
        )
        row = (await self.session.execute(stmt)).one_or_none()
        if row is None or row.total_cal is None:
            return []

        total_cal = float(row.total_cal)
        total_pro = float(row.total_pro)
        total_carb = float(row.total_carb)
        total_fat = float(row.total_fat)

        # Get latest adaptive snapshot for targets
        snap_stmt = (
            select(AdaptiveSnapshot)
            .where(AdaptiveSnapshot.user_id == user_id)
            .order_by(AdaptiveSnapshot.created_at.desc())
            .limit(1)
        )
        snap = (await self.session.execute(snap_stmt)).scalar_one_or_none()
        if snap is None:
            logger.warning("No adaptive snapshot for user %s — skipping compliance check", user_id)
            return []

        # Check compliance: each macro within 5% of target
        compliant = self._is_compliant(
            actuals=(total_cal, total_pro, total_carb, total_fat),
            targets=(snap.target_calories, snap.target_protein_g, snap.target_carbs_g, snap.target_fat_g),
        )

        # Update compliance streak
        progress = await self._get_or_create_progress(user_id, "nutrition_compliance")
        meta = progress.metadata_ or {}
        last_compliant_str = meta.get("last_compliant_date")

        if compliant:
            if last_compliant_str is not None:
                last_compliant = date.fromisoformat(last_compliant_str)
                if entry_date == last_compliant + timedelta(days=1):
                    progress.current_value += 1
                elif entry_date == last_compliant:
                    pass  # same day re-evaluation, no change
                else:
                    progress.current_value = 1
            else:
                progress.current_value = 1
            progress.metadata_ = {"last_compliant_date": entry_date.isoformat()}
        else:
            progress.current_value = 0
            progress.metadata_ = {}

        await self.session.flush()

        # Check nutrition thresholds
        unlocked: list[NewlyUnlockedResponse] = []
        existing = await self._get_unlocked_ids(user_id, AchievementCategory.NUTRITION)

        for defn in ACHIEVEMENT_REGISTRY.values():
            if defn.category != AchievementCategory.NUTRITION:
                continue
            if defn.id in existing:
                continue
            if progress.current_value >= defn.threshold:
                result = await self._try_unlock(user_id, defn.id)
                if result is not None:
                    unlocked.append(result)
                    existing.add(defn.id)

        return unlocked

    @staticmethod
    def _is_compliant(
        actuals: tuple[float, float, float, float],
        targets: tuple[float, float, float, float],
        tolerance: float = 0.05,
    ) -> bool:
        """Return True if every macro actual is within *tolerance* of its target."""
        for actual, target in zip(actuals, targets):
            if target is None or target <= 0:
                return False  # guard against None and division by zero
            if actual is None:
                return False
            if abs(actual - target) / target > tolerance:
                return False
        return True

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _get_unlocked_ids(
        self, user_id: uuid.UUID, category: AchievementCategory
    ) -> set[str]:
        """Return the set of achievement IDs already unlocked by this user in *category*."""
        category_ids = [
            d.id for d in ACHIEVEMENT_REGISTRY.values() if d.category == category
        ]
        if not category_ids:
            return set()
        stmt = select(UserAchievement.achievement_id).where(
            UserAchievement.user_id == user_id,
            UserAchievement.achievement_id.in_(category_ids),
            UserAchievement.deleted_at.is_(None),
        )
        result = await self.session.execute(stmt)
        return {row[0] for row in result.all()}

    async def _get_or_create_progress(
        self, user_id: uuid.UUID, progress_type: str
    ) -> AchievementProgress:
        """Fetch or create an AchievementProgress row."""
        stmt = select(AchievementProgress).where(
            AchievementProgress.user_id == user_id,
            AchievementProgress.progress_type == progress_type,
        )
        result = await self.session.execute(stmt)
        progress = result.scalar_one_or_none()
        if progress is None:
            progress = AchievementProgress(
                user_id=user_id,
                progress_type=progress_type,
                current_value=0,
                metadata_={},
            )
            self.session.add(progress)
            await self.session.flush()
        return progress

    async def _try_unlock(
        self,
        user_id: uuid.UUID,
        achievement_id: str,
        trigger_data: Optional[dict[str, Any]] = None,
    ) -> Optional[NewlyUnlockedResponse]:
        """Attempt to create a UserAchievement row.

        Uses a savepoint so that a unique-constraint violation does not
        roll back the outer transaction.  Returns the response on success,
        or ``None`` if the achievement was already unlocked.
        """
        defn = ACHIEVEMENT_REGISTRY.get(achievement_id)
        if defn is None:
            return None

        ua = UserAchievement(
            user_id=user_id,
            achievement_id=achievement_id,
            unlocked_at=datetime.now(timezone.utc),
            trigger_data=trigger_data,
        )
        try:
            async with self.session.begin_nested():
                self.session.add(ua)
                await self.session.flush()
        except IntegrityError:
            # Already unlocked — treat as no-op
            return None

        logger.info("achievement.unlock user=%s achievement=%s", user_id, achievement_id)
        return NewlyUnlockedResponse(
            achievement_id=defn.id,
            title=defn.title,
            description=defn.description,
            icon=defn.icon,
            category=defn.category,
        )
