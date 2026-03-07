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
        result = await self._db.execute(
            select(TrainingSession).where(TrainingSession.id == session_id)
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
            "pr_count": 0,
        }
