"""Training Analytics Service — computes volume, strength, and frequency metrics."""

from __future__ import annotations
from typing import Optional

import uuid
from collections import defaultdict
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.training.analytics_schemas import (
    E1RMHistoryPoint,
    MuscleGroupFrequency,
    StrengthClassificationResponse,
    StrengthProgressionPoint,
    StrengthStandardsResponse,
    MilestoneResponse,
    VolumeTrendPoint,
)
from src.modules.training.e1rm_calculator import best_e1rm_for_exercise, compute_e1rm
from src.modules.training.exercise_mapping import get_muscle_group
from src.modules.training.milestone_generator import generate_milestones
from src.modules.training.models import TrainingSession
from src.modules.training.strength_standards import (
    SUPPORTED_LIFTS,
    classify_strength,
)
from src.modules.user.models import BodyweightLog


class TrainingAnalyticsService:
    """Computes training analytics from the training_sessions table."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_volume_trend(
        self,
        user_id: uuid.UUID,
        start_date: date,
        end_date: date,
        muscle_group: Optional[str] = None,
    ) -> list[VolumeTrendPoint]:
        """Compute total volume (reps × weight_kg) per session day.

        If *muscle_group* is provided, only exercises mapping to that group
        are included in the sum.
        """
        rows = await self._fetch_sessions(user_id, start_date, end_date)

        daily_volume: dict[date, float] = defaultdict(float)
        for session_date, exercises in rows:
            for ex in exercises:
                if muscle_group is not None:
                    if get_muscle_group(ex.get("exercise_name", "")) != muscle_group:
                        continue
                for s in ex.get("sets", []):
                    reps = s.get("reps", 0)
                    weight = s.get("weight_kg", 0.0)
                    daily_volume[session_date] += reps * weight

        return sorted(
            [VolumeTrendPoint(date=d, total_volume=v) for d, v in daily_volume.items()],
            key=lambda p: p.date,
        )

    async def get_strength_progression(
        self,
        user_id: uuid.UUID,
        exercise_name: str,
        start_date: date,
        end_date: date,
    ) -> list[StrengthProgressionPoint]:
        """Compute best set per session for *exercise_name*.

        The "best set" is the one with the highest (weight_kg × reps) product.
        Epley e1RM is computed as weight × (1 + reps / 30) when reps > 0.
        """
        rows = await self._fetch_sessions(user_id, start_date, end_date)
        target = exercise_name.lower().strip()

        points: list[StrengthProgressionPoint] = []
        for session_date, exercises in rows:
            best_product = -1.0
            best_weight = 0.0
            best_reps = 0
            found = False

            for ex in exercises:
                if ex.get("exercise_name", "").lower().strip() != target:
                    continue
                found = True
                for s in ex.get("sets", []):
                    reps = s.get("reps", 0)
                    weight = s.get("weight_kg", 0.0)
                    product = weight * reps
                    if product > best_product:
                        best_product = product
                        best_weight = weight
                        best_reps = reps

            if found and best_product >= 0:
                e1rm: Optional[float] = None
                if best_reps > 0 and best_weight > 0:
                    e1rm = round(best_weight * (1 + best_reps / 30), 2)
                points.append(
                    StrengthProgressionPoint(
                        date=session_date,
                        exercise_name=exercise_name,
                        best_weight_kg=best_weight,
                        best_reps=best_reps,
                        estimated_1rm=e1rm,
                    )
                )

        return sorted(points, key=lambda p: p.date)

    async def get_muscle_group_frequency(
        self,
        user_id: uuid.UUID,
        start_date: date,
        end_date: date,
    ) -> list[MuscleGroupFrequency]:
        """Compute sessions per muscle group per ISO week."""
        rows = await self._fetch_sessions(user_id, start_date, end_date)

        # group_week_sessions: {(muscle_group, iso_week_start): set of session_dates}
        group_week_sessions: dict[tuple[str, date], set[date]] = defaultdict(set)

        for session_date, exercises in rows:
            week_start = _iso_week_start(session_date)
            seen_groups: set[str] = set()
            for ex in exercises:
                mg = get_muscle_group(ex.get("exercise_name", ""))
                if mg not in seen_groups:
                    seen_groups.add(mg)
                    group_week_sessions[(mg, week_start)].add(session_date)

        result: list[MuscleGroupFrequency] = []
        for (mg, ws), sessions in group_week_sessions.items():
            result.append(
                MuscleGroupFrequency(
                    muscle_group=mg,
                    week_start=ws,
                    session_count=len(sessions),
                )
            )

        return sorted(result, key=lambda f: (f.week_start, f.muscle_group))

    # ------------------------------------------------------------------
    # e1RM History and Strength Standards
    # ------------------------------------------------------------------

    async def get_e1rm_history(
        self,
        user_id: uuid.UUID,
        exercise_name: str,
        start_date: date,
        end_date: date,
    ) -> list[E1RMHistoryPoint]:
        """Best e1RM per calendar date for exercise in date range. Sorted by date ascending.

        When multiple sessions exist on the same date, the highest e1RM across
        all sessions on that date is used (one point per date).
        """
        rows = await self._fetch_sessions(user_id, start_date, end_date)
        target = exercise_name.lower().strip()

        # Group by date — take max e1RM across all sessions on the same date
        best_per_date: dict[date, float] = {}
        for session_date, exercises in rows:
            all_sets: list[dict] = []
            for ex in exercises:
                if ex.get("exercise_name", "").lower().strip() == target:
                    all_sets.extend(ex.get("sets", []))

            if not all_sets:
                continue

            best = best_e1rm_for_exercise(all_sets)
            if best is not None:
                current = best_per_date.get(session_date)
                if current is None or best.primary > current:
                    best_per_date[session_date] = best.primary

        points = [
            E1RMHistoryPoint(
                date=d,
                exercise_name=exercise_name,
                e1rm_kg=round(e1rm, 2),
                formula="epley",
                low_confidence=False,
            )
            for d, e1rm in best_per_date.items()
        ]

        return sorted(points, key=lambda p: p.date)

    async def get_strength_standards(
        self,
        user_id: uuid.UUID,
    ) -> StrengthStandardsResponse:
        """Classification + milestones for all supported lifts.

        Fetches latest bodyweight, best e1RM per supported lift, classifies,
        generates milestones. No bodyweight → empty classifications/milestones.
        """
        # Fetch latest bodyweight
        bw_stmt = (
            select(BodyweightLog.weight_kg)
            .where(BodyweightLog.user_id == user_id)
            .order_by(BodyweightLog.recorded_date.desc())
            .limit(1)
        )
        bw_result = await self.session.execute(bw_stmt)
        bw_row = bw_result.scalar_one_or_none()

        if bw_row is None:
            return StrengthStandardsResponse(
                classifications=[], milestones=[], bodyweight_kg=None
            )

        bodyweight_kg = float(bw_row)

        # Fetch ALL sessions (no date filter) to find best e1RM ever per supported lift
        all_stmt = select(
            TrainingSession.session_date,
            TrainingSession.exercises,
        ).where(TrainingSession.user_id == user_id)
        all_stmt = TrainingSession.not_deleted(all_stmt)
        result = await self.session.execute(all_stmt)
        all_sessions = [(row.session_date, row.exercises or []) for row in result]

        # Find best e1RM per supported lift
        best_e1rm_per_lift: dict[str, float] = {}
        for _session_date, exercises in all_sessions:
            for ex in exercises:
                ex_name = ex.get("exercise_name", "").lower().strip()
                if ex_name not in SUPPORTED_LIFTS:
                    continue
                sets = ex.get("sets", [])
                best = best_e1rm_for_exercise(sets)
                if best is not None:
                    if ex_name not in best_e1rm_per_lift or best.primary > best_e1rm_per_lift[ex_name]:
                        best_e1rm_per_lift[ex_name] = best.primary

        # Classify each lift
        from src.modules.training.strength_standards import StrengthClassification as SC
        classifications: list[SC] = []
        for lift_name, e1rm_val in best_e1rm_per_lift.items():
            c = classify_strength(lift_name, e1rm_val, bodyweight_kg)
            classifications.append(c)

        # Generate milestones
        milestones = generate_milestones(classifications)

        # Convert to response schemas
        classification_responses = [
            StrengthClassificationResponse(
                exercise_name=c.exercise_name,
                e1rm_kg=round(c.e1rm_kg, 2),
                bodyweight_kg=round(c.bodyweight_kg, 2),
                bodyweight_ratio=c.bodyweight_ratio,
                level=c.level.value,
                next_level=c.next_level.value if c.next_level else None,
                next_level_threshold_kg=c.next_level_threshold_kg,
            )
            for c in classifications
        ]

        milestone_responses = [
            MilestoneResponse(
                exercise_name=m.exercise_name,
                current_e1rm_kg=round(m.current_e1rm_kg, 2),
                next_level=m.next_level.value if m.next_level else None,
                deficit_kg=m.deficit_kg,
                message=m.message,
            )
            for m in milestones
        ]

        return StrengthStandardsResponse(
            classifications=classification_responses,
            milestones=milestone_responses,
            bodyweight_kg=round(bodyweight_kg, 2),
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _fetch_sessions(
        self, user_id: uuid.UUID, start_date: date, end_date: date
    ) -> list[tuple[date, list[dict]]]:
        """Fetch non-deleted sessions in the date range, returning (date, exercises) pairs."""
        stmt = select(
            TrainingSession.session_date,
            TrainingSession.exercises,
        ).where(
            TrainingSession.user_id == user_id,
            TrainingSession.session_date >= start_date,
            TrainingSession.session_date <= end_date,
        )
        stmt = TrainingSession.not_deleted(stmt)
        stmt = stmt.order_by(TrainingSession.session_date)

        result = await self.session.execute(stmt)
        return [(row.session_date, row.exercises or []) for row in result]


def _iso_week_start(d: date) -> date:
    """Return the Monday of the ISO week containing *d*."""
    return d - __import__("datetime").timedelta(days=d.weekday())
