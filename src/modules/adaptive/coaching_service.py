"""Coaching service — weekly check-in orchestration for adaptive coaching tiers.

Handles three coaching modes:
  - coached: auto-apply new targets from the adaptive engine
  - collaborative: create a pending suggestion for user review
  - manual: return info-only, no target changes
"""

from __future__ import annotations
from typing import Optional

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.adaptive.engine import (
    AdaptiveInput,
    AdaptiveOutput,
    compute_snapshot,
    _compute_ema,
    _compute_ema_n_days_ago,
    _filter_extreme_fluctuations,
)
from src.modules.adaptive.models import AdaptiveSnapshot, CoachingSuggestion
from src.modules.adaptive.schemas import (
    CoachingSuggestionResponse,
    MacroModifications,
    MacroTargets,
    WeeklyCheckinResponse,
)
from src.modules.nutrition.models import NutritionEntry
from src.modules.user.models import BodyweightLog, UserGoal, UserMetric, UserProfile
from src.shared.errors import NotFoundError
from src.shared.types import ActivityLevel, GoalType


MIN_BODYWEIGHT_ENTRIES = 7


class CoachingService:
    """Orchestrates weekly check-ins across coaching modes."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def generate_weekly_checkin(self, user_id: uuid.UUID) -> WeeklyCheckinResponse:
        """Generate a weekly check-in based on the user's coaching mode."""

        # 1. Load user profile
        profile = await self._get_profile(user_id)
        coaching_mode = profile.coaching_mode if profile else "coached"

        # Idempotency: if snapshot already created today, return it
        existing = await self._get_today_snapshot(user_id)
        if existing is not None:
            return await self._build_response_from_snapshot(
                existing, user_id, coaching_mode,
            )

        # 2. Load last 14 days bodyweight
        bw_entries = await self._get_recent_bodyweight(user_id, days=14)

        # 3. Insufficient data check
        if len(bw_entries) < MIN_BODYWEIGHT_ENTRIES:
            return WeeklyCheckinResponse(
                has_sufficient_data=False,
                days_remaining=MIN_BODYWEIGHT_ENTRIES - len(bw_entries),
                explanation=f"Log {MIN_BODYWEIGHT_ENTRIES - len(bw_entries)} more days for personalized recommendations",
                coaching_mode=coaching_mode,
            )

        # 4. Build AdaptiveInput and compute snapshot
        goal = await self._get_goal(user_id)
        metrics = await self._get_latest_metrics(user_id)

        weight_kg = bw_entries[-1][1]  # latest weight
        height_cm = metrics.height_cm if metrics and metrics.height_cm else 170.0
        age_years = metrics.age_years if metrics and hasattr(metrics, "age_years") else 30
        sex = "male"  # default; could be stored on profile
        activity_level = ActivityLevel(metrics.activity_level) if metrics and metrics.activity_level else ActivityLevel.MODERATE
        goal_type = GoalType(goal.goal_type) if goal else GoalType.MAINTAINING
        goal_rate = goal.goal_rate_per_week if goal and goal.goal_rate_per_week else 0.0

        engine_input = AdaptiveInput(
            weight_kg=weight_kg,
            height_cm=height_cm,
            age_years=age_years,
            sex=sex,
            activity_level=activity_level,
            goal_type=goal_type,
            goal_rate_per_week=goal_rate,
            bodyweight_history=bw_entries,
            training_load_score=50.0,  # default mid-range
        )

        output = compute_snapshot(engine_input)

        # 5. Compare with previous snapshot
        prev_snapshot = await self._get_latest_snapshot(user_id)
        prev_targets = None
        if prev_snapshot:
            prev_targets = MacroTargets(
                calories=prev_snapshot.target_calories,
                protein_g=prev_snapshot.target_protein_g,
                carbs_g=prev_snapshot.target_carbs_g,
                fat_g=prev_snapshot.target_fat_g,
            )

        # Compute weight trend
        sorted_history = sorted(bw_entries, key=lambda t: t[0])
        filtered = _filter_extreme_fluctuations(sorted_history)
        history_for_ema = filtered if filtered else sorted_history
        ema_current = _compute_ema(history_for_ema)
        ema_7d_ago = _compute_ema_n_days_ago(history_for_ema, n_days=7)
        weekly_change = (ema_current - ema_7d_ago) if ema_7d_ago is not None else None

        # 6. Generate explanation
        explanation = self._generate_explanation(
            prev_targets, output, ema_current, ema_7d_ago,
        )

        new_targets = MacroTargets(
            calories=output.target_calories,
            protein_g=output.target_protein_g,
            carbs_g=output.target_carbs_g,
            fat_g=output.target_fat_g,
        )

        # 7. Mode-specific behavior
        suggestion_id: Optional[uuid.UUID] = None

        if coaching_mode == "coached":
            # Auto-persist snapshot and update targets
            snapshot = await self._persist_snapshot(user_id, engine_input, output)
        elif coaching_mode == "collaborative":
            # Persist snapshot and create pending suggestion
            snapshot = await self._persist_snapshot(user_id, engine_input, output)
            suggestion = CoachingSuggestion(
                user_id=user_id,
                snapshot_id=snapshot.id,
                status="pending",
                proposed_calories=output.target_calories,
                proposed_protein_g=output.target_protein_g,
                proposed_carbs_g=output.target_carbs_g,
                proposed_fat_g=output.target_fat_g,
                explanation=explanation,
            )
            self.db.add(suggestion)
            await self.db.flush()
            suggestion_id = suggestion.id
        else:
            # Manual mode: info-only, return current targets unchanged
            new_targets = prev_targets if prev_targets else new_targets

        return WeeklyCheckinResponse(
            has_sufficient_data=True,
            new_targets=new_targets,
            previous_targets=prev_targets,
            weight_trend=round(ema_current, 2),
            weekly_weight_change=round(weekly_change, 2) if weekly_change is not None else None,
            explanation=explanation,
            suggestion_id=suggestion_id,
            coaching_mode=coaching_mode,
        )

    def _generate_explanation(
        self,
        prev_targets: Optional[MacroTargets],
        new_output: AdaptiveOutput,
        ema_current: float,
        ema_7d_ago: Optional[float],
    ) -> str:
        """Template-based explanation for the check-in card."""
        parts: list[str] = []

        # Weight direction
        if ema_7d_ago is not None:
            change = ema_current - ema_7d_ago
            if change < -0.05:
                parts.append(f"You lost {abs(change):.1f}kg this week")
            elif change > 0.05:
                parts.append(f"You gained {abs(change):.1f}kg this week")
            else:
                parts.append("Your weight maintained this week")
        else:
            parts.append("First check-in — building your baseline")

        # Target change
        if prev_targets:
            cal_diff = new_output.target_calories - prev_targets.calories
            if abs(cal_diff) > 10:
                direction = "increased" if cal_diff > 0 else "reduced"
                parts.append(
                    f"Calories {direction} from {prev_targets.calories:.0f} to {new_output.target_calories:.0f} ({cal_diff:+.0f})"
                )
            else:
                parts.append("Targets unchanged")
        else:
            parts.append(
                f"Initial targets set: {new_output.target_calories:.0f} calories"
            )

        return " — ".join(parts)

    async def accept_suggestion(
        self, user_id: uuid.UUID, suggestion_id: uuid.UUID,
    ) -> None:
        """Apply proposed targets. Set status='accepted'."""
        suggestion = await self._get_suggestion(user_id, suggestion_id)
        suggestion.status = "accepted"
        suggestion.resolved_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def modify_suggestion(
        self,
        user_id: uuid.UUID,
        suggestion_id: uuid.UUID,
        modifications: MacroModifications,
    ) -> None:
        """Store user's modified values. Set status='modified'."""
        suggestion = await self._get_suggestion(user_id, suggestion_id)
        suggestion.status = "modified"
        suggestion.modified_calories = modifications.calories
        suggestion.modified_protein_g = modifications.protein_g
        suggestion.modified_carbs_g = modifications.carbs_g
        suggestion.modified_fat_g = modifications.fat_g
        suggestion.resolved_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def dismiss_suggestion(
        self, user_id: uuid.UUID, suggestion_id: uuid.UUID,
    ) -> None:
        """Set status='dismissed'. No target changes."""
        suggestion = await self._get_suggestion(user_id, suggestion_id)
        suggestion.status = "dismissed"
        suggestion.resolved_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def get_pending_suggestions(
        self, user_id: uuid.UUID,
    ) -> list[CoachingSuggestionResponse]:
        """Return all pending suggestions for a user."""
        stmt = (
            select(CoachingSuggestion)
            .where(
                CoachingSuggestion.user_id == user_id,
                CoachingSuggestion.status == "pending",
            )
            .order_by(CoachingSuggestion.created_at.desc())
        )
        result = await self.db.execute(stmt)
        rows = result.scalars().all()
        return [CoachingSuggestionResponse.model_validate(r) for r in rows]

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _get_profile(self, user_id: uuid.UUID) -> Optional[UserProfile]:
        stmt = select(UserProfile).where(UserProfile.user_id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_recent_bodyweight(
        self, user_id: uuid.UUID, days: int = 14,
    ) -> list[tuple[date, float]]:
        cutoff = date.today() - timedelta(days=days)
        stmt = (
            select(BodyweightLog)
            .where(
                BodyweightLog.user_id == user_id,
                BodyweightLog.recorded_date >= cutoff,
            )
            .order_by(BodyweightLog.recorded_date.asc())
        )
        result = await self.db.execute(stmt)
        rows = result.scalars().all()
        return [(row.recorded_date, row.weight_kg) for row in rows]

    async def _get_goal(self, user_id: uuid.UUID) -> Optional[UserGoal]:
        stmt = select(UserGoal).where(UserGoal.user_id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_latest_metrics(self, user_id: uuid.UUID) -> Optional[UserMetric]:
        stmt = (
            select(UserMetric)
            .where(UserMetric.user_id == user_id)
            .order_by(UserMetric.recorded_at.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_latest_snapshot(self, user_id: uuid.UUID) -> Optional[AdaptiveSnapshot]:
        stmt = (
            select(AdaptiveSnapshot)
            .where(AdaptiveSnapshot.user_id == user_id)
            .order_by(AdaptiveSnapshot.created_at.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_today_snapshot(self, user_id: uuid.UUID) -> Optional[AdaptiveSnapshot]:
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0,
        )
        stmt = (
            select(AdaptiveSnapshot)
            .where(
                AdaptiveSnapshot.user_id == user_id,
                AdaptiveSnapshot.created_at >= today_start,
            )
            .order_by(AdaptiveSnapshot.created_at.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _persist_snapshot(
        self,
        user_id: uuid.UUID,
        engine_input: AdaptiveInput,
        output: AdaptiveOutput,
    ) -> AdaptiveSnapshot:
        input_params = {
            "weight_kg": engine_input.weight_kg,
            "height_cm": engine_input.height_cm,
            "age_years": engine_input.age_years,
            "sex": engine_input.sex,
            "activity_level": engine_input.activity_level.value,
            "goal_type": engine_input.goal_type.value,
            "goal_rate_per_week": engine_input.goal_rate_per_week,
            "training_load_score": engine_input.training_load_score,
        }
        snapshot = AdaptiveSnapshot(
            user_id=user_id,
            target_calories=output.target_calories,
            target_protein_g=output.target_protein_g,
            target_carbs_g=output.target_carbs_g,
            target_fat_g=output.target_fat_g,
            ema_current=output.ema_current,
            adjustment_factor=output.adjustment_factor,
            input_parameters=input_params,
        )
        self.db.add(snapshot)
        await self.db.flush()
        return snapshot

    async def _get_suggestion(
        self, user_id: uuid.UUID, suggestion_id: uuid.UUID,
    ) -> CoachingSuggestion:
        stmt = select(CoachingSuggestion).where(
            CoachingSuggestion.id == suggestion_id,
            CoachingSuggestion.user_id == user_id,
        )
        result = await self.db.execute(stmt)
        suggestion = result.scalar_one_or_none()
        if suggestion is None:
            raise NotFoundError("Coaching suggestion not found")
        return suggestion

    async def _build_response_from_snapshot(
        self,
        snapshot: AdaptiveSnapshot,
        user_id: uuid.UUID,
        coaching_mode: str,
    ) -> WeeklyCheckinResponse:
        """Build a WeeklyCheckinResponse from an existing snapshot (idempotency)."""
        new_targets = MacroTargets(
            calories=snapshot.target_calories,
            protein_g=snapshot.target_protein_g,
            carbs_g=snapshot.target_carbs_g,
            fat_g=snapshot.target_fat_g,
        )

        # Check for pending suggestion
        suggestion_id = None
        if coaching_mode == "collaborative":
            stmt = (
                select(CoachingSuggestion)
                .where(
                    CoachingSuggestion.snapshot_id == snapshot.id,
                    CoachingSuggestion.user_id == user_id,
                )
                .limit(1)
            )
            result = await self.db.execute(stmt)
            suggestion = result.scalar_one_or_none()
            if suggestion:
                suggestion_id = suggestion.id

        return WeeklyCheckinResponse(
            has_sufficient_data=True,
            new_targets=new_targets,
            weight_trend=round(snapshot.ema_current, 2),
            explanation="Weekly check-in already completed today",
            suggestion_id=suggestion_id,
            coaching_mode=coaching_mode,
        )
