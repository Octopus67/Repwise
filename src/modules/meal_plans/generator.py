"""Pure meal plan generation — greedy algorithm, no DB access."""

from __future__ import annotations
from typing import Optional

import logging
import uuid
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class MacroSummary:
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float


@dataclass(frozen=True)
class MealSlotTarget:
    slot: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float


@dataclass(frozen=True)
class FoodCandidate:
    food_item_id: uuid.UUID
    name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    is_recipe: bool
    source_priority: int  # 0=favorite, 1=recent, 2=database


@dataclass(frozen=True)
class MealAssignment:
    slot: str
    food_item_id: uuid.UUID
    name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    scale_factor: float
    is_recipe: bool


@dataclass(frozen=True)
class DayPlan:
    day_index: int
    assignments: list[MealAssignment]
    unfilled_slots: list[str]


@dataclass(frozen=True)
class GeneratedPlan:
    days: list[DayPlan]
    daily_macro_summaries: list[MacroSummary]
    weekly_macro_summary: MacroSummary


DEFAULT_SLOT_SPLITS: dict[str, float] = {
    "breakfast": 0.25,
    "lunch": 0.30,
    "dinner": 0.35,
    "snack": 0.10,
}


def distribute_macros(
    daily_targets: MacroSummary,
    slot_splits: Optional[dict[str, float]] = None,
) -> list[MealSlotTarget]:
    """Split daily targets across slots. Raises ValueError if splits don't sum to ~1.0."""
    splits = slot_splits or DEFAULT_SLOT_SPLITS
    total = sum(splits.values())
    if abs(total - 1.0) > 0.01:
        raise ValueError(f"Slot splits must sum to ~1.0, got {total:.4f}")

    return [
        MealSlotTarget(
            slot=slot,
            calories=round(daily_targets.calories * pct, 2),
            protein_g=round(daily_targets.protein_g * pct, 2),
            carbs_g=round(daily_targets.carbs_g * pct, 2),
            fat_g=round(daily_targets.fat_g * pct, 2),
        )
        for slot, pct in splits.items()
    ]


def compute_day_summary(assignments: list[MealAssignment]) -> MacroSummary:
    """Sum macros across all assignments for a day."""
    return MacroSummary(
        calories=round(sum(a.calories for a in assignments), 2),
        protein_g=round(sum(a.protein_g for a in assignments), 2),
        carbs_g=round(sum(a.carbs_g for a in assignments), 2),
        fat_g=round(sum(a.fat_g for a in assignments), 2),
    )


def compute_weekly_summary(day_summaries: list[MacroSummary]) -> MacroSummary:
    """Sum macros across all days."""
    return MacroSummary(
        calories=round(sum(d.calories for d in day_summaries), 2),
        protein_g=round(sum(d.protein_g for d in day_summaries), 2),
        carbs_g=round(sum(d.carbs_g for d in day_summaries), 2),
        fat_g=round(sum(d.fat_g for d in day_summaries), 2),
    )


def _calorie_distance(candidate: FoodCandidate, target: MealSlotTarget) -> float:
    """Absolute calorie difference between candidate and slot target."""
    return abs(candidate.calories - target.calories)


def generate_plan(
    daily_targets: MacroSummary,
    candidates: list[FoodCandidate],
    slot_splits: Optional[dict[str, float]] = None,
    num_days: int = 5,
    tolerance: float = 0.05,
) -> GeneratedPlan:
    """Greedy assignment: sort candidates by priority, pick closest match per slot."""
    if num_days < 1 or num_days > 14:
        raise ValueError(f"num_days must be between 1 and 14, got {num_days}")

    slot_targets = distribute_macros(daily_targets, slot_splits)

    if not candidates:
        empty_days = [
            DayPlan(day_index=i, assignments=[], unfilled_slots=[t.slot for t in slot_targets])
            for i in range(num_days)
        ]
        empty_summaries = [MacroSummary(0, 0, 0, 0)] * num_days
        return GeneratedPlan(
            days=empty_days,
            daily_macro_summaries=empty_summaries,
            weekly_macro_summary=MacroSummary(0, 0, 0, 0),
        )

    # Sort by priority first, then by calorie content for stable ordering
    sorted_candidates = sorted(candidates, key=lambda c: (c.source_priority, c.calories))

    days: list[DayPlan] = []
    day_summaries: list[MacroSummary] = []

    for day_idx in range(num_days):
        assignments: list[MealAssignment] = []
        unfilled: list[str] = []

        for target in slot_targets:
            best: Optional[MealAssignment] = None
            best_dist = float("inf")

            for cand in sorted_candidates:
                if cand.calories <= 0:
                    continue
                # Compute scale factor to hit target calories
                factor = target.calories / cand.calories if cand.calories > 0 else 0
                if factor <= 0:
                    continue

                scaled_cal = cand.calories * factor
                dist = abs(scaled_cal - target.calories)

                if dist < best_dist:
                    best_dist = dist
                    best = MealAssignment(
                        slot=target.slot,
                        food_item_id=cand.food_item_id,
                        name=cand.name,
                        calories=round(cand.calories * factor, 2),
                        protein_g=round(cand.protein_g * factor, 2),
                        carbs_g=round(cand.carbs_g * factor, 2),
                        fat_g=round(cand.fat_g * factor, 2),
                        scale_factor=round(factor, 4),
                        is_recipe=cand.is_recipe,
                    )

            if best is not None:
                assignments.append(best)
            else:
                unfilled.append(target.slot)

        day_summary = compute_day_summary(assignments)
        days.append(DayPlan(day_index=day_idx, assignments=assignments, unfilled_slots=unfilled))
        day_summaries.append(day_summary)

    weekly = compute_weekly_summary(day_summaries)
    return GeneratedPlan(days=days, daily_macro_summaries=day_summaries, weekly_macro_summary=weekly)
