"""Training service — CRUD for training sessions."""

from __future__ import annotations
from typing import Optional

import logging
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.training.models import PersonalRecord, TrainingSession
from src.modules.training.pr_detector import PRDetector
from src.modules.training.schemas import (
    NewlyUnlockedAchievement,
    PersonalRecordResponse,
    TrainingSessionCreate,
    TrainingSessionListItem,
    TrainingSessionResponse,
    TrainingSessionUpdate,
)
from src.shared.errors import NotFoundError
from src.shared.pagination import PaginatedResult, PaginationParams
from src.shared.types import AuditAction

logger = logging.getLogger(__name__)


class TrainingService:
    """Handles training session creation, retrieval, update, and soft-delete."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_session(
        self, user_id: uuid.UUID, data: TrainingSessionCreate
    ) -> TrainingSessionResponse:
        """Persist a new training session and detect personal records (Requirement 6.1, 4.3)."""
        # Detect PRs against historical data BEFORE persisting the new session
        pr_detector = PRDetector(self.session)
        prs = await pr_detector.detect_prs(user_id, data.exercises)

        training = TrainingSession(
            user_id=user_id,
            session_date=data.session_date,
            exercises=[ex.model_dump() for ex in data.exercises],
            metadata_=data.metadata,
            start_time=data.start_time,
            end_time=data.end_time,
        )
        self.session.add(training)
        await self.session.flush()

        # Persist PRs to personal_records table for history
        # PR detector currently only detects weight-based PRs.
        # Deferred: reps/volume/e1RM PRs planned for v2
        for pr in prs:
            self.session.add(
                PersonalRecord(
                    user_id=user_id,
                    exercise_name=pr.exercise_name,
                    pr_type="weight",  # Only weight PRs detected currently
                    reps=pr.reps,
                    value_kg=pr.new_weight_kg,
                    previous_value_kg=pr.previous_weight_kg,
                    session_id=training.id,
                )
            )
        if prs:
            await self.session.flush()

        pr_responses = [
            PersonalRecordResponse(
                exercise_name=pr.exercise_name,
                reps=pr.reps,
                new_weight_kg=pr.new_weight_kg,
                previous_weight_kg=pr.previous_weight_kg,
            )
            for pr in prs
        ]

        # --- PR celebration notification (Phase 4) ---
        if prs:
            try:
                from src.modules.notifications.service import NotificationService

                notif_svc = NotificationService(self.session)
                await notif_svc.send_push(
                    user_id=user_id,
                    title="New PR!",
                    body=f"You hit {len(prs)} personal record(s)!",
                    notification_type="pr_celebration",
                    data={"screen": "SessionDetail", "sessionId": str(training.id)},
                )
            except (ImportError, RuntimeError, ValueError) as e:
                # Non-critical — PR notification failure must not break session creation
                logger.exception("PR celebration notification failed: %s", type(e).__name__)

        # --- Achievement evaluation (never breaks session creation) ---
        achievement_unlocks: list[NewlyUnlockedAchievement] = []
        try:
            from src.modules.achievements.engine import AchievementEngine

            engine = AchievementEngine(self.session)
            raw_unlocks = await engine.evaluate_training_session(
                user_id=user_id,
                exercises=[ex.model_dump() for ex in data.exercises],
                session_date=data.session_date,
            )
            achievement_unlocks = [
                NewlyUnlockedAchievement(
                    achievement_id=u.achievement_id,
                    title=u.title,
                    description=u.description,
                    icon=u.icon,
                    category=u.category,
                )
                for u in raw_unlocks
            ]
        except (ImportError, RuntimeError, ValueError) as e:
            # Non-critical — achievement failure must not break session creation
            logger.exception("Achievement evaluation failed for training session: %s", type(e).__name__)

        # Update weekly challenge progress
        try:
            from src.modules.challenges.service import update_challenge_progress_from_session
            exercises_raw = [ex.model_dump() if hasattr(ex, 'model_dump') else ex for ex in data.exercises] if data.exercises else []
            await update_challenge_progress_from_session(self.session, user_id, exercises_raw)
        except (ImportError, RuntimeError, ValueError) as e:
            # Non-critical — challenge tracking failure must not break session creation
            logger.exception("Failed to update challenge progress for user %s: %s", user_id, type(e).__name__)

        # Generate social feed event (non-critical)
        try:
            from src.modules.social.service import SocialService

            social_svc = SocialService(self.session)
            duration_min = None
            if data.start_time and data.end_time:
                duration_min = int((data.end_time - data.start_time).total_seconds() / 60)
            await social_svc.create_feed_event(
                user_id=user_id,
                event_type="workout",
                ref_id=training.id,
                metadata={
                    "exercise_count": len(data.exercises) if data.exercises else 0,
                    "duration_min": duration_min,
                },
            )
        except (ImportError, RuntimeError, ValueError) as e:
            # Non-critical — feed event failure must not break session creation
            logger.exception("Feed event creation failed for session %s: %s", training.id, type(e).__name__)

        return TrainingSessionResponse.from_orm_model(
            training, personal_records=pr_responses, newly_unlocked=achievement_unlocks
        )

    async def get_sessions(
        self,
        user_id: uuid.UUID,
        pagination: PaginationParams,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        *,
        lightweight: bool = False,
    ) -> PaginatedResult:
        """Return paginated training sessions filtered by date range (Requirement 6.2).

        When lightweight=True, returns TrainingSessionListItem (no full exercises JSONB).
        Default returns full TrainingSessionResponse for backward compatibility.
        """
        base = select(TrainingSession).where(TrainingSession.user_id == user_id)
        base = TrainingSession.not_deleted(base)

        if start_date is not None:
            base = base.where(TrainingSession.session_date >= start_date)
        if end_date is not None:
            base = base.where(TrainingSession.session_date <= end_date)

        # Total count
        count_stmt = select(func.count()).select_from(base.subquery())
        total_count = (await self.session.execute(count_stmt)).scalar_one()

        # Paginated results ordered by session_date DESC
        items_stmt = (
            base.order_by(TrainingSession.session_date.desc())
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        result = await self.session.execute(items_stmt)
        rows = result.scalars().all()

        mapper = TrainingSessionListItem.from_orm_model if lightweight else TrainingSessionResponse.from_orm_model

        return PaginatedResult(
            items=[mapper(r) for r in rows],
            total_count=total_count,
            page=pagination.page,
            limit=pagination.limit,
        )

    async def update_session(
        self,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
        data: TrainingSessionUpdate,
    ) -> TrainingSessionResponse:
        """Update a training session with audit trail (Requirement 6.3)."""
        training = await self._get_or_404(user_id, session_id)

        changes: dict[str, dict] = {}
        pr_responses: list[PersonalRecordResponse] = []
        if data.session_date is not None and data.session_date != training.session_date:
            changes["session_date"] = {
                "old": str(training.session_date),
                "new": str(data.session_date),
            }
            training.session_date = data.session_date

        if data.exercises is not None:
            changes["exercises"] = {"old": training.exercises}
            training.exercises = [ex.model_dump() for ex in data.exercises]
            changes["exercises"]["new"] = training.exercises

            # Re-run PR detection on updated exercises
            pr_detector = PRDetector(self.session)
            prs = await pr_detector.detect_prs(user_id, data.exercises)
            for pr in prs:
                self.session.add(
                    PersonalRecord(
                        user_id=user_id,
                        exercise_name=pr.exercise_name,
                        pr_type="weight",
                        reps=pr.reps,
                        value_kg=pr.new_weight_kg,
                        previous_value_kg=pr.previous_weight_kg,
                        session_id=session_id,
                    )
                )
            pr_responses = [
                PersonalRecordResponse(
                    exercise_name=pr.exercise_name,
                    reps=pr.reps,
                    new_weight_kg=pr.new_weight_kg,
                    previous_weight_kg=pr.previous_weight_kg,
                )
                for pr in prs
            ]

        if data.metadata is not None:
            changes["metadata"] = {"old": training.metadata_}
            training.metadata_ = data.metadata
            changes["metadata"]["new"] = training.metadata_

        if data.start_time is not None and data.start_time != training.start_time:
            changes["start_time"] = {
                "old": str(training.start_time) if training.start_time else None,
                "new": str(data.start_time),
            }
            training.start_time = data.start_time

        if data.end_time is not None and data.end_time != training.end_time:
            changes["end_time"] = {
                "old": str(training.end_time) if training.end_time else None,
                "new": str(data.end_time),
            }
            training.end_time = data.end_time

        if changes:
            await TrainingSession.write_audit(
                self.session,
                user_id=user_id,
                action=AuditAction.UPDATE,
                entity_id=session_id,
                changes=changes,
            )

        await self.session.flush()
        return TrainingSessionResponse.from_orm_model(training, personal_records=pr_responses)

    async def soft_delete_session(
        self, user_id: uuid.UUID, session_id: uuid.UUID
    ) -> None:
        """Soft-delete a training session (Requirement 6.4)."""
        training = await self._get_or_404(user_id, session_id)
        training.deleted_at = datetime.now(timezone.utc)

        await TrainingSession.write_audit(
            self.session,
            user_id=user_id,
            action=AuditAction.DELETE,
            entity_id=session_id,
        )
        await self.session.flush()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_or_404(
        self, user_id: uuid.UUID, session_id: uuid.UUID
    ) -> TrainingSession:
        """Fetch a non-deleted training session or raise NotFoundError."""
        stmt = select(TrainingSession).where(
            TrainingSession.id == session_id,
            TrainingSession.user_id == user_id,
        )
        stmt = TrainingSession.not_deleted(stmt)
        result = await self.session.execute(stmt)
        training = result.scalar_one_or_none()
        if training is None:
            raise NotFoundError("Training session not found")
        return training
    async def get_session_by_id(
        self, user_id: uuid.UUID, session_id: uuid.UUID
    ) -> TrainingSessionResponse:
        """Return a single training session by ID (Requirement 8.1)."""
        training = await self._get_or_404(user_id, session_id)
        return TrainingSessionResponse.from_orm_model(training)

    async def get_sessions_for_date(
        self, user_id: uuid.UUID, target_date: str
    ) -> list[TrainingSessionResponse]:
        """Return all training sessions for a specific date."""
        from datetime import date as date_type

        parsed = date_type.fromisoformat(target_date) if isinstance(target_date, str) else target_date
        stmt = select(TrainingSession).where(
            TrainingSession.user_id == user_id,
            TrainingSession.session_date == parsed,
        )
        stmt = TrainingSession.not_deleted(stmt)
        stmt = stmt.order_by(TrainingSession.created_at.desc())
        result = await self.session.execute(stmt)
        rows = result.scalars().all()
        return [TrainingSessionResponse.from_orm_model(r) for r in rows]

    async def get_streak_count(self, user_id: uuid.UUID) -> int:
        """Return the current consecutive-day training streak."""
        from datetime import timedelta

        stmt = (
            select(TrainingSession.session_date)
            .where(TrainingSession.user_id == user_id)
            .distinct()
        )
        stmt = TrainingSession.not_deleted(stmt)
        stmt = stmt.order_by(TrainingSession.session_date.desc())
        result = await self.session.execute(stmt)
        dates = [row[0] for row in result.all()]

        if not dates:
            return 0

        streak = 1
        for i in range(1, len(dates)):
            if dates[i - 1] - dates[i] == timedelta(days=1):
                streak += 1
            else:
                break
        return streak


