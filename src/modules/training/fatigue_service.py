"""Fatigue Service — async orchestration layer."""

from __future__ import annotations
from typing import Optional

import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.training.exercise_mapping import get_muscle_group
from src.modules.training.fatigue_engine import (
    FatigueConfig,
    MRV_SETS_PER_WEEK,
    SessionExerciseData,
    SetData,
    compute_best_e1rm_per_session,
    compute_fatigue_score,
    compute_nutrition_compliance,
    detect_regressions,
    generate_suggestions,
)
from src.modules.training.fatigue_schemas import (
    DeloadSuggestionResponse,
    FatigueAnalysisResponse,
    FatigueScoreResponse,
)
from src.modules.training.models import TrainingSession


class FatigueService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def analyze_fatigue(
        self, user_id: uuid.UUID, lookback_days: int = 28
    ) -> FatigueAnalysisResponse:
        # Validate lookback_days range (matches schema constraint ge=7, le=90)
        if not isinstance(lookback_days, int) or lookback_days < 7:
            lookback_days = 7
        elif lookback_days > 90:
            lookback_days = 90

        config = FatigueConfig(lookback_days=lookback_days)
        today = date.today()
        start = today - timedelta(days=lookback_days)

        # 1. Fetch non-deleted training sessions
        stmt = select(
            TrainingSession.session_date,
            TrainingSession.exercises,
        ).where(
            TrainingSession.user_id == user_id,
            TrainingSession.session_date >= start,
            TrainingSession.session_date <= today,
        )
        stmt = TrainingSession.not_deleted(stmt)
        result = await self.session.execute(stmt)
        rows = [(r.session_date, r.exercises or []) for r in result]

        # 2. Flatten into SessionExerciseData
        flat: list[SessionExerciseData] = []
        for session_date, exercises in rows:
            if not isinstance(exercises, list):
                continue
            for ex in exercises:
                if not isinstance(ex, dict):
                    continue
                exercise_name = ex.get("exercise_name", "")
                if not exercise_name or not isinstance(exercise_name, str):
                    continue
                raw_sets = ex.get("sets", [])
                if not isinstance(raw_sets, list):
                    continue
                sets = []
                for s in raw_sets:
                    if not isinstance(s, dict):
                        continue
                    reps = s.get("reps", 0)
                    weight = s.get("weight_kg", 0.0)
                    if isinstance(reps, (int, float)) and isinstance(weight, (int, float)):
                        sets.append(SetData(reps=int(reps), weight_kg=float(weight)))
                if sets:
                    flat.append(SessionExerciseData(
                        session_date=session_date,
                        exercise_name=exercise_name.strip(),
                        sets=sets,
                    ))

        # 3-4. Compute e1RM and detect regressions
        e1rm_series = compute_best_e1rm_per_session(flat)
        regressions = detect_regressions(e1rm_series, config.min_sessions_for_regression)

        # 5. Weekly sets and frequency per muscle group
        weeks = max(lookback_days / 7.0, 1.0)
        mg_sets: dict[str, int] = defaultdict(int)
        mg_dates: dict[str, set[date]] = defaultdict(set)
        for s in flat:
            mg = get_muscle_group(s.exercise_name)
            mg_sets[mg] += len(s.sets)
            mg_dates[mg].add(s.session_date)

        # 6. Nutrition compliance
        nutrition_compliance: Optional[float] = None
        try:
            from src.modules.nutrition.models import NutritionEntry
            from src.modules.adaptive.models import AdaptiveSnapshot

            cal_stmt = select(func.sum(NutritionEntry.calories)).where(
                NutritionEntry.user_id == user_id,
                NutritionEntry.entry_date >= start,
                NutritionEntry.entry_date <= today,
            )
            cal_result = await self.session.execute(cal_stmt)
            total_cal = cal_result.scalar_one_or_none() or 0.0

            snap_stmt = (
                select(AdaptiveSnapshot.target_calories)
                .where(AdaptiveSnapshot.user_id == user_id)
                .order_by(AdaptiveSnapshot.created_at.desc())
                .limit(1)
            )
            snap_result = await self.session.execute(snap_stmt)
            target_cal = snap_result.scalar_one_or_none()

            if total_cal and target_cal:
                daily_avg = total_cal / max(lookback_days, 1)
                nutrition_compliance = compute_nutrition_compliance(daily_avg, target_cal)
        except Exception:
            nutrition_compliance = None

        # 7. Compute fatigue scores per muscle group
        all_muscle_groups = set(mg_sets.keys())
        for r in regressions:
            all_muscle_groups.add(r.muscle_group)

        scores = []
        for mg in sorted(all_muscle_groups):
            weekly_sets = int(mg_sets.get(mg, 0) / weeks)
            weekly_freq = int(len(mg_dates.get(mg, set())) / weeks)
            mrv = MRV_SETS_PER_WEEK.get(mg, 0)
            score = compute_fatigue_score(
                mg, regressions, weekly_sets, mrv, weekly_freq,
                nutrition_compliance, config,
            )
            scores.append(score)

        # 8. Generate suggestions
        suggestions = generate_suggestions(scores, regressions, config)

        # 9. Build response
        return FatigueAnalysisResponse(
            scores=[
                FatigueScoreResponse(
                    muscle_group=s.muscle_group,
                    score=round(s.score, 1),
                    regression_component=round(s.regression_component, 3),
                    volume_component=round(s.volume_component, 3),
                    frequency_component=round(s.frequency_component, 3),
                    nutrition_component=round(s.nutrition_component, 3),
                )
                for s in scores
            ],
            suggestions=[
                DeloadSuggestionResponse(
                    muscle_group=sg.muscle_group,
                    fatigue_score=round(sg.fatigue_score, 1),
                    top_regressed_exercise=sg.top_regressed_exercise,
                    decline_pct=round(sg.decline_pct, 1),
                    decline_sessions=sg.decline_sessions,
                    message=sg.message,
                )
                for sg in suggestions
            ],
            lookback_days=lookback_days,
            analyzed_at=datetime.utcnow(),
        )
