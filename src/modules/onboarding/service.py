"""Onboarding service — orchestrates full user setup in a single transaction."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.adaptive.engine import AdaptiveInput, compute_snapshot
from src.modules.adaptive.models import AdaptiveSnapshot
from src.modules.adaptive.schemas import SnapshotResponse
from src.modules.onboarding.schemas import OnboardingCompleteRequest, OnboardingCompleteResponse
from src.modules.user.models import UserGoal, UserMetric, UserProfile
from src.modules.user.schemas import (
    UserGoalResponse,
    UserGoalSet,
    UserMetricCreate,
    UserProfileResponse,
    UserProfileUpdate,
)
from src.modules.user.service import UserService
from src.shared.errors import ConflictError


class OnboardingService:
    """Orchestrates the complete onboarding flow within a single DB session."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def complete_onboarding(
        self, user_id: uuid.UUID, data: OnboardingCompleteRequest
    ) -> OnboardingCompleteResponse:
        """Run all onboarding steps within the caller's transaction.

        Steps:
        1. Check for existing UserGoal → 409 if exists
        2. Create/update UserProfile
        3. Persist UserMetric snapshot
        4. Set UserGoal
        5. Compute adaptive snapshot
        6. Persist AdaptiveSnapshot
        """
        user_svc = UserService(self.db)

        # Step 1 — conflict guard
        existing_goal = await user_svc.get_goals(user_id)
        if existing_goal is not None:
            raise ConflictError("Onboarding already completed")

        # Step 2 — profile
        profile = await user_svc.update_profile(
            user_id, UserProfileUpdate(display_name=data.display_name)
        )

        # Step 2b — Store Food DNA preferences
        prefs = profile.preferences or {}
        food_dna_fields = {
            "dietary_restrictions": data.dietary_restrictions,
            "allergies": data.allergies,
            "cuisine_preferences": data.cuisine_preferences,
            "meal_frequency": data.meal_frequency,
            "diet_style": data.diet_style,
            "protein_per_kg": data.protein_per_kg,
            "exercise_types": data.exercise_types,
            "exercise_sessions_per_week": data.exercise_sessions_per_week,
        }
        for key, value in food_dna_fields.items():
            if value is not None:
                prefs[key] = value

        # Persist age and sex for later recalculation (adaptive engine needs these)
        prefs["age_years"] = data.age_years
        prefs["sex"] = data.sex

        if prefs != (profile.preferences or {}):
            profile.preferences = prefs
            await self.db.flush()

        # Step 3 — metrics
        await user_svc.log_metrics(
            user_id,
            UserMetricCreate(
                height_cm=data.height_cm,
                weight_kg=data.weight_kg,
                body_fat_pct=data.body_fat_pct,
                activity_level=data.activity_level,
            ),
        )

        # Step 4 — goals
        goals = await user_svc.set_goals(
            user_id,
            UserGoalSet(
                goal_type=data.goal_type,
                goal_rate_per_week=data.goal_rate_per_week,
            ),
        )

        # Step 5 — adaptive computation (pure, no I/O)
        today = date.today()
        engine_input = AdaptiveInput(
            weight_kg=data.weight_kg,
            height_cm=data.height_cm,
            age_years=data.age_years,
            sex=data.sex,
            activity_level=data.activity_level,
            goal_type=data.goal_type,
            goal_rate_per_week=data.goal_rate_per_week,
            bodyweight_history=[(today, data.weight_kg)],
            training_load_score=0.0,
        )
        output = compute_snapshot(engine_input)

        # Step 6 — persist snapshot
        input_params = data.model_dump(mode="json")
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
        await self.db.refresh(snapshot)

        snapshot_response = SnapshotResponse.model_validate(snapshot)

        return OnboardingCompleteResponse(
            profile=profile,
            goals=goals,
            snapshot=snapshot_response,
        )
