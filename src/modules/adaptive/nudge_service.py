"""Smart nudge service — proactive suggestions for goal/target updates."""
import uuid
from datetime import date, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.adaptive.models import AdaptiveSnapshot
from src.modules.user.models import BodyweightLog, UserGoal


class NudgeType:
    WEIGHT_PLATEAU = "weight_plateau"
    GOAL_REACHED = "goal_reached"
    STALE_TARGETS = "stale_targets"


class Nudge:
    def __init__(self, type: str, title: str, message: str, action: str):
        self.type = type
        self.title = title
        self.message = message
        self.action = action


class NudgeService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_nudges(self, user_id: uuid.UUID) -> list[dict]:
        nudges = []
        
        # Check stale targets
        stale = await self._check_stale_targets(user_id)
        if stale:
            nudges.append(stale)
        
        # Check goal reached
        reached = await self._check_goal_reached(user_id)
        if reached:
            nudges.append(reached)
        
        # Check weight plateau
        plateau = await self._check_weight_plateau(user_id)
        if plateau:
            nudges.append(plateau)
        
        return [{'type': n.type, 'title': n.title, 'message': n.message, 'action': n.action} for n in nudges]
    
    async def _check_stale_targets(self, user_id: uuid.UUID) -> Optional[Nudge]:
        """Targets not updated in 4+ weeks."""
        snap = (await self.db.execute(
            select(AdaptiveSnapshot)
            .where(AdaptiveSnapshot.user_id == user_id)
            .order_by(AdaptiveSnapshot.created_at.desc())
            .limit(1)
        )).scalar_one_or_none()
        
        if snap is None:
            return None
        
        days_since = (date.today() - snap.created_at.date()).days
        if days_since >= 28:
            return Nudge(
                type=NudgeType.STALE_TARGETS,
                title="Targets need refreshing",
                message=f"Your calorie targets haven't been updated in {days_since} days. Tap to recalculate based on your current weight.",
                action="recalculate",
            )
        return None
    
    async def _check_goal_reached(self, user_id: uuid.UUID) -> Optional[Nudge]:
        """User within 1kg of target weight."""
        goal = (await self.db.execute(
            select(UserGoal).where(UserGoal.user_id == user_id)
        )).scalar_one_or_none()
        
        if not goal or not goal.target_weight_kg:
            return None
        
        # Get latest bodyweight
        bw = (await self.db.execute(
            select(BodyweightLog)
            .where(BodyweightLog.user_id == user_id)
            .order_by(BodyweightLog.recorded_date.desc())
            .limit(1)
        )).scalar_one_or_none()
        
        if not bw:
            return None
        
        diff = abs(bw.weight_kg - goal.target_weight_kg)
        if diff <= 1.0:
            return Nudge(
                type=NudgeType.GOAL_REACHED,
                title="Goal almost reached!",
                message=f"You're within {diff:.1f}kg of your target. Consider switching to maintenance.",
                action="edit_goals",
            )
        return None
    
    async def _check_weight_plateau(self, user_id: uuid.UUID) -> Optional[Nudge]:
        """Weight hasn't changed in 2+ weeks while on cut/bulk."""
        goal = (await self.db.execute(
            select(UserGoal).where(UserGoal.user_id == user_id)
        )).scalar_one_or_none()
        
        if not goal or goal.goal_type == 'maintaining':
            return None
        
        # Get last 14 days of bodyweight
        cutoff = date.today() - timedelta(days=14)
        bw_rows = (await self.db.execute(
            select(BodyweightLog)
            .where(BodyweightLog.user_id == user_id, BodyweightLog.recorded_date >= cutoff)
            .order_by(BodyweightLog.recorded_date.asc())
        )).scalars().all()
        
        if len(bw_rows) < 5:
            return None
        
        first_avg = sum(r.weight_kg for r in bw_rows[:3]) / 3
        last_avg = sum(r.weight_kg for r in bw_rows[-3:]) / 3
        change = abs(last_avg - first_avg)
        
        if change < 0.3:  # Less than 300g change in 2 weeks = plateau
            action_word = "losing" if goal.goal_type == 'cutting' else "gaining"
            return Nudge(
                type=NudgeType.WEIGHT_PLATEAU,
                title="Weight plateau detected",
                message=f"Your weight hasn't changed much in 2 weeks. Consider adjusting your calorie target to keep {action_word}.",
                action="recalculate",
            )
        return None