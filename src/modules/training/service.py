"""Training service — CRUD for training sessions."""

from __future__ import annotations
from typing import Optional

import logging
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.training.models import TrainingSession
from src.modules.training.pr_detector import PRDetector
from src.modules.training.schemas import (
    NewlyUnlockedAchievement,
    PersonalRecordResponse,
    TrainingSessionCreate,
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

        pr_responses = [
            PersonalRecordResponse(
                exercise_name=pr.exercise_name,
                reps=pr.reps,
                new_weight_kg=pr.new_weight_kg,
                previous_weight_kg=pr.previous_weight_kg,
            )
            for pr in prs
        ]

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
        except Exception:
            logger.exception("Achievement evaluation failed for training session")

        return TrainingSessionResponse.from_orm_model(
            training, personal_records=pr_responses, newly_unlocked=achievement_unlocks
        )

    async def get_sessions(
        self,
        user_id: uuid.UUID,
        pagination: PaginationParams,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> PaginatedResult[TrainingSessionResponse]:
        """Return paginated training sessions filtered by date range (Requirement 6.2)."""
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

        return PaginatedResult[TrainingSessionResponse](
            items=[TrainingSessionResponse.from_orm_model(r) for r in rows],
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
        return TrainingSessionResponse.from_orm_model(training)

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


