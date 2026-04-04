"""Sharing service — share event tracking and public workout rendering."""

from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.sharing.models import Referral, ShareEvent
from src.modules.training.models import TrainingSession
from src.modules.auth.models import User
from src.shared.errors import NotFoundError

logger = logging.getLogger(__name__)


class SharingService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def track_share(
        self,
        user_id: UUID,
        session_id: Optional[UUID] = None,
        share_type: str = "workout",
        platform: Optional[str] = None,
    ) -> ShareEvent:
        if session_id:
            sess_check = await self._db.execute(
                select(TrainingSession.id).where(
                    TrainingSession.id == session_id,
                    TrainingSession.user_id == user_id,
                    TrainingSession.deleted_at.is_(None),
                )
            )
            if sess_check.scalar_one_or_none() is None:
                raise NotFoundError("Training session not found")

        event = ShareEvent(
            user_id=user_id,
            session_id=session_id,
            share_type=share_type,
            platform=platform,
        )
        self._db.add(event)
        await self._db.flush()
        return event

    async def track_referral(
        self,
        referrer_id: UUID,
        visitor_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Referral:
        referral = Referral(
            referrer_id=referrer_id,
            visitor_ip=visitor_ip,
            user_agent=user_agent,
        )
        self._db.add(referral)
        await self._db.flush()
        return referral

    async def get_shared_workout(self, session_id: UUID) -> dict | None:
        """Fetch a training session for public sharing (no auth required)."""
        # Verify a ShareEvent exists for this session — only explicitly shared sessions are accessible
        share_check = await self._db.execute(
            select(ShareEvent.id).where(ShareEvent.session_id == session_id).limit(1)
        )
        if share_check.scalar_one_or_none() is None:
            return None

        result = await self._db.execute(
            TrainingSession.not_deleted(
                select(TrainingSession).where(TrainingSession.id == session_id)
            )
        )
        session = result.scalar_one_or_none()
        if session is None:
            return None

        # Get user display name
        user_result = await self._db.execute(
            select(User).where(User.id == session.user_id)
        )
        user = user_result.scalar_one_or_none()
        display_name = user.email.split("@")[0] if user else "Athlete"

        exercises = session.exercises or []
        total_sets = sum(len(ex.get("sets", [])) for ex in exercises)
        total_volume = 0
        for ex in exercises:
            for s in ex.get("sets", []):
                st = s.get("set_type", "normal")
                if st != "warm-up":
                    total_volume += s.get("weight_kg", 0) * s.get("reps", 0)

        # Calculate PR count: compare each exercise's max weight against
        # all previous sessions for the same user.
        pr_count = 0
        current_maxes: dict[str, float] = {}
        for ex in exercises:
            name = ex.get("exercise_name", "")
            if not name:
                continue
            for s in ex.get("sets", []):
                if s.get("set_type") == "warm-up":
                    continue
                w = s.get("weight_kg", 0)
                if w > current_maxes.get(name, 0):
                    current_maxes[name] = w

        if current_maxes:
            prev_result = await self._db.execute(
                TrainingSession.not_deleted(
                    select(TrainingSession).where(
                        TrainingSession.user_id == session.user_id,
                        TrainingSession.session_date < session.session_date,
                    )
                ).with_only_columns(TrainingSession.exercises)
            )
            prev_exercises_list = prev_result.scalars().all()

            # Build historical max per exercise name
            historical_maxes: dict[str, float] = {}
            for prev_exercises in prev_exercises_list:
                for ex in (prev_exercises or []):
                    pname = ex.get("exercise_name", "")
                    if pname not in current_maxes:
                        continue
                    for s in ex.get("sets", []):
                        if s.get("set_type") == "warm-up":
                            continue
                        w = s.get("weight_kg", 0)
                        if w > historical_maxes.get(pname, 0):
                            historical_maxes[pname] = w

            for name, cur_max in current_maxes.items():
                if cur_max > 0 and cur_max > historical_maxes.get(name, 0):
                    pr_count += 1

        return {
            "session_id": str(session.id),
            "user_display_name": display_name,
            "session_date": session.session_date,
            "exercise_count": len(exercises),
            "total_sets": total_sets,
            "total_volume_kg": round(total_volume),
            "exercises": [
                {
                    "name": ex.get("exercise_name", "Unknown"),
                    "sets": len(ex.get("sets", [])),
                }
                for ex in exercises[:10]
            ],
            "pr_count": pr_count,
        }
