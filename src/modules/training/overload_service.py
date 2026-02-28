"""Progressive overload suggestion service.

Analyses recent training sessions for an exercise and recommends
weight/rep targets based on RPE trends and equipment type.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.training.exercises import get_all_exercises
from src.modules.training.models import TrainingSession
from src.modules.training.schemas import OverloadSuggestion

# Default RPE when a set has no RPE recorded
_DEFAULT_RPE = 7.5

# Number of recent sessions required / fetched
_MIN_SESSIONS = 3
_MAX_SESSIONS = 5


@dataclass
class _SessionSnapshot:
    """Lightweight snapshot of one session's data for a single exercise."""

    weight_kg: float
    reps: int
    avg_rpe: float


# ---------------------------------------------------------------------------
# Pure algorithm — fully testable without DB
# ---------------------------------------------------------------------------


def _get_equipment_for_exercise(exercise_name: str) -> str:
    """Look up equipment type from the static exercise database.

    Returns the equipment string (e.g. "barbell", "dumbbell") or
    ``"other"`` when the exercise is not found.
    """
    name_lower = exercise_name.lower().strip()
    for ex in get_all_exercises():
        if ex["name"].lower() == name_lower:
            return ex.get("equipment", "other")
    return "other"


def _weight_increment(equipment: str) -> float:
    """Return the minimum weight increment for the given equipment type."""
    if equipment == "barbell":
        return 2.5
    if equipment in ("dumbbell", "cable"):
        return 1.0
    # Default for machine, bodyweight, etc.
    return 2.5


def compute_suggestion(
    exercise_name: str,
    snapshots: list[_SessionSnapshot],
    equipment: str | None = None,
) -> OverloadSuggestion | None:
    """Compute an overload suggestion from recent session snapshots.

    Parameters
    ----------
    exercise_name:
        Human-readable exercise name.
    snapshots:
        Recent session data ordered newest-first.  Must contain at least
        ``_MIN_SESSIONS`` entries.
    equipment:
        Equipment type override.  When *None* the equipment is looked up
        from the static exercise database.

    Returns ``None`` when there is insufficient data.
    """
    if len(snapshots) < _MIN_SESSIONS:
        return None

    # Use up to _MAX_SESSIONS most recent
    recent = snapshots[:_MAX_SESSIONS]

    avg_rpe = sum(s.avg_rpe for s in recent) / len(recent)
    latest = recent[0]

    if equipment is None:
        equipment = _get_equipment_for_exercise(exercise_name)

    # Confidence based on session count
    confidence = "high" if len(recent) >= 5 else "medium"

    if avg_rpe < 7:
        increment = _weight_increment(equipment)
        return OverloadSuggestion(
            exercise_name=exercise_name,
            suggested_weight_kg=latest.weight_kg + increment,
            suggested_reps=latest.reps,
            reasoning=f"Avg RPE {avg_rpe:.1f} — increase weight by {increment}kg",
            confidence=confidence,
        )

    if avg_rpe <= 9:
        return OverloadSuggestion(
            exercise_name=exercise_name,
            suggested_weight_kg=latest.weight_kg,
            suggested_reps=latest.reps + 1,
            reasoning=f"Avg RPE {avg_rpe:.1f} — add 1 rep at same weight",
            confidence=confidence,
        )

    # avg_rpe > 9
    return OverloadSuggestion(
        exercise_name=exercise_name,
        suggested_weight_kg=latest.weight_kg,
        suggested_reps=latest.reps,
        reasoning=f"Avg RPE {avg_rpe:.1f} — maintain current load",
        confidence=confidence,
    )


# ---------------------------------------------------------------------------
# Async service that fetches data from the DB
# ---------------------------------------------------------------------------


class OverloadSuggestionService:
    """Fetches recent session data and delegates to the pure algorithm."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_suggestion(
        self, user_id: uuid.UUID, exercise_name: str
    ) -> Optional[OverloadSuggestion]:
        """Return an overload suggestion or *None* if insufficient data."""
        snapshots = await self._fetch_snapshots(user_id, exercise_name)
        return compute_suggestion(exercise_name, snapshots)

    async def get_batch_suggestions(
        self, user_id: uuid.UUID, exercise_names: list[str]
    ) -> dict[str, OverloadSuggestion | None]:
        """Return overload suggestions for multiple exercises with a single DB query.

        Fetches the last 50 sessions once and extracts per-exercise snapshots
        from the cached result, avoiding N separate queries.
        """
        # Single DB fetch — same query as _fetch_snapshots but unfiltered by exercise
        stmt = (
            select(TrainingSession)
            .where(TrainingSession.user_id == user_id)
        )
        stmt = TrainingSession.not_deleted(stmt)
        stmt = stmt.order_by(TrainingSession.session_date.desc()).limit(50)

        result = await self.session.execute(stmt)
        rows = result.scalars().all()

        suggestions: dict[str, OverloadSuggestion | None] = {}

        for exercise_name in exercise_names:
            name_lower = exercise_name.lower().strip()
            snapshots: list[_SessionSnapshot] = []

            for row in rows:
                for ex in row.exercises:
                    if ex.get("exercise_name", "").lower().strip() != name_lower:
                        continue
                    sets = ex.get("sets", [])
                    if not sets:
                        continue

                    rpe_values = [
                        s["rpe"] for s in sets
                        if s.get("rpe") is not None and s.get("set_type", "normal") == "normal"
                    ]
                    avg_rpe = (
                        sum(rpe_values) / len(rpe_values)
                        if rpe_values
                        else _DEFAULT_RPE
                    )

                    normal_sets = [
                        s for s in sets if s.get("set_type", "normal") == "normal"
                    ]
                    if not normal_sets:
                        continue
                    best = max(normal_sets, key=lambda s: s.get("weight_kg", 0))

                    snapshots.append(
                        _SessionSnapshot(
                            weight_kg=best.get("weight_kg", 0),
                            reps=best.get("reps", 0),
                            avg_rpe=avg_rpe,
                        )
                    )
                    break  # one snapshot per session

                if len(snapshots) >= _MAX_SESSIONS:
                    break

            suggestions[exercise_name] = compute_suggestion(exercise_name, snapshots)

        return suggestions


    async def _fetch_snapshots(
        self, user_id: uuid.UUID, exercise_name: str
    ) -> list[_SessionSnapshot]:
        """Fetch the last ``_MAX_SESSIONS`` sessions containing *exercise_name*."""
        stmt = (
            select(TrainingSession)
            .where(TrainingSession.user_id == user_id)
        )
        stmt = TrainingSession.not_deleted(stmt)
        stmt = stmt.order_by(TrainingSession.session_date.desc()).limit(50)

        result = await self.session.execute(stmt)
        rows = result.scalars().all()

        name_lower = exercise_name.lower().strip()
        snapshots: list[_SessionSnapshot] = []

        for row in rows:
            for ex in row.exercises:
                if ex.get("exercise_name", "").lower().strip() != name_lower:
                    continue
                sets = ex.get("sets", [])
                if not sets:
                    continue

                # Compute average RPE for this exercise in this session
                rpe_values = [
                    s["rpe"] for s in sets
                    if s.get("rpe") is not None and s.get("set_type", "normal") == "normal"
                ]
                avg_rpe = (
                    sum(rpe_values) / len(rpe_values)
                    if rpe_values
                    else _DEFAULT_RPE
                )

                # Use the heaviest normal set as the representative weight/reps
                normal_sets = [
                    s for s in sets if s.get("set_type", "normal") == "normal"
                ]
                if not normal_sets:
                    continue
                best = max(normal_sets, key=lambda s: s.get("weight_kg", 0))

                snapshots.append(
                    _SessionSnapshot(
                        weight_kg=best.get("weight_kg", 0),
                        reps=best.get("reps", 0),
                        avg_rpe=avg_rpe,
                    )
                )
                break  # one snapshot per session

            if len(snapshots) >= _MAX_SESSIONS:
                break

        return snapshots
