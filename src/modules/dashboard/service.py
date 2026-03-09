"""Dashboard service — aggregates data from multiple modules."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.dashboard.schemas import DashboardSummaryResponse
from src.modules.nutrition.service import NutritionService
from src.modules.adaptive.service import AdaptiveService
from src.modules.training.service import TrainingService
from src.modules.user.service import UserService


class DashboardService:
    """Aggregates dashboard data from multiple services."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_summary(
        self, user_id: uuid.UUID, target_date: str
    ) -> DashboardSummaryResponse:
        """Fetch all dashboard data in parallel."""
        from asyncio import gather
        
        nutrition_svc = NutritionService(self.db)
        adaptive_svc = AdaptiveService(self.db)
        training_svc = TrainingService(self.db)
        user_svc = UserService(self.db)
        
        # Parallel fetch
        (
            nutrition_entries,
            adaptive_snapshot,
            training_sessions,
            bodyweight_history,
            streak_count,
        ) = await gather(
            nutrition_svc.get_entries_for_date(user_id, target_date),
            adaptive_svc.get_latest_snapshot(user_id),
            training_svc.get_sessions_for_date(user_id, target_date),
            user_svc.get_bodyweight_history(user_id, limit=30),
            training_svc.get_streak_count(user_id),
            return_exceptions=True,
        )
        
        # Handle exceptions from gather
        if isinstance(nutrition_entries, Exception):
            nutrition_entries = []
        if isinstance(adaptive_snapshot, Exception):
            adaptive_snapshot = None
        if isinstance(training_sessions, Exception):
            training_sessions = []
        if isinstance(bodyweight_history, Exception):
            bodyweight_history = []
        if isinstance(streak_count, Exception):
            streak_count = 0
        
        # Calculate KPIs from nutrition entries
        total_calories = sum(e.calories for e in nutrition_entries) if nutrition_entries else 0
        total_protein = sum(e.protein_g for e in nutrition_entries) if nutrition_entries else 0
        total_carbs = sum(e.carbs_g for e in nutrition_entries) if nutrition_entries else 0
        total_fat = sum(e.fat_g for e in nutrition_entries) if nutrition_entries else 0
        
        return DashboardSummaryResponse(
            date=target_date,
            nutrition={
                "entries": nutrition_entries or [],
                "total_calories": total_calories,
                "total_protein": total_protein,
                "total_carbs": total_carbs,
                "total_fat": total_fat,
            },
            adaptive_targets=adaptive_snapshot,
            training={
                "sessions": training_sessions or [],
                "streak_count": streak_count,
            },
            bodyweight_history=bodyweight_history or [],
        )
