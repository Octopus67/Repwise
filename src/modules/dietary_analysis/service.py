"""Business logic for dietary trend analysis and gap detection.

Includes pure functions ``compute_daily_averages`` and ``detect_gaps``
for testability (Requirements 9.2, 9.3).
"""

from __future__ import annotations
from typing import Optional

import uuid
from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.nutrition.models import NutritionEntry
from src.modules.nutrition.schemas import DateRangeFilter
from src.shared.pagination import PaginationParams


# ---------------------------------------------------------------------------
# Data classes for pure function I/O
# ---------------------------------------------------------------------------

@dataclass
class DailyAverages:
    """Average daily intake per nutrient over a time window."""

    calories: float = 0.0
    protein_g: float = 0.0
    carbs_g: float = 0.0
    fat_g: float = 0.0
    micro_nutrients: dict[str, float] = field(default_factory=dict)
    num_days: int = 0


@dataclass
class RecommendedIntake:
    """Recommended daily values for nutrients."""

    calories: float = 2000.0
    protein_g: float = 50.0
    carbs_g: float = 275.0
    fat_g: float = 78.0
    micro_nutrients: dict[str, float] = field(default_factory=dict)


@dataclass
class NutritionGap:
    """A nutrient that falls below recommended daily intake."""

    nutrient: str
    average_intake: float
    recommended_value: float
    deficit_percentage: float  # (recommended - average) / recommended * 100


@dataclass
class DailySummary:
    """Nutrient summary for a single day (for chart visualization)."""

    date: date
    calories: float = 0.0
    protein_g: float = 0.0
    carbs_g: float = 0.0
    fat_g: float = 0.0
    micro_nutrients: dict[str, float] = field(default_factory=dict)


@dataclass
class DietaryTrendReport:
    """Complete dietary trend analysis result."""

    window_days: int
    daily_summaries: list[DailySummary]
    averages: DailyAverages
    gaps: list[NutritionGap]


@dataclass
class FoodRecommendation:
    """A food recommendation to address a nutritional gap."""

    nutrient: str
    food_name: str
    nutrient_amount_per_serving: float
    serving_size: str


# ---------------------------------------------------------------------------
# Seed data: recommended daily values
# ---------------------------------------------------------------------------

RECOMMENDED_DAILY_VALUES: dict[str, float] = {
    "calories": 2000.0,
    "protein_g": 50.0,
    "carbs_g": 275.0,
    "fat_g": 78.0,
    "fiber": 28.0,
    "sodium": 2300.0,
    "iron": 18.0,
    "calcium": 1000.0,
    "vitamin_d": 20.0,  # mcg
    "vitamin_b12": 2.4,  # mcg
    "vitamin_c": 90.0,  # mg
    "potassium": 2600.0,  # mg
    "magnesium": 420.0,  # mg
    "zinc": 11.0,  # mg
}


# ---------------------------------------------------------------------------
# Pure function: compute_daily_averages
# ---------------------------------------------------------------------------

@dataclass
class NutritionEntryData:
    """Lightweight representation of a nutrition entry for pure functions."""

    entry_date: date
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    micro_nutrients: Optional[dict[str, float]] = None


def compute_daily_averages(
    entries: list[NutritionEntryData],
    num_days: int,
) -> DailyAverages:
    """Compute average daily intake per nutrient over a time window.

    Pure function — no side effects.

    Sums all entries' values and divides by ``num_days`` for each nutrient.
    If ``num_days`` is 0, returns zero averages.

    **Validates: Requirements 9.2**
    """
    if num_days <= 0:
        return DailyAverages(num_days=0)

    total_cal = 0.0
    total_protein = 0.0
    total_carbs = 0.0
    total_fat = 0.0
    micro_totals: dict[str, float] = {}

    for entry in entries:
        total_cal += entry.calories
        total_protein += entry.protein_g
        total_carbs += entry.carbs_g
        total_fat += entry.fat_g
        if entry.micro_nutrients:
            for k, v in entry.micro_nutrients.items():
                micro_totals[k] = micro_totals.get(k, 0.0) + v

    return DailyAverages(
        calories=total_cal / num_days,
        protein_g=total_protein / num_days,
        carbs_g=total_carbs / num_days,
        fat_g=total_fat / num_days,
        micro_nutrients={k: v / num_days for k, v in micro_totals.items()},
        num_days=num_days,
    )


# ---------------------------------------------------------------------------
# Pure function: detect_gaps
# ---------------------------------------------------------------------------

def detect_gaps(
    averages: DailyAverages,
    recommended: RecommendedIntake,
) -> list[NutritionGap]:
    """Identify nutrients below recommended daily intake levels.

    Pure function — no side effects.

    For each nutrient where average < recommended, includes it in the gaps
    list with deficit_percentage = (recommended - average) / recommended × 100.
    Nutrients at or above the recommended value are excluded.

    **Validates: Requirements 9.3**
    """
    gaps: list[NutritionGap] = []

    # Check macro nutrients
    macro_checks = [
        ("calories", averages.calories, recommended.calories),
        ("protein_g", averages.protein_g, recommended.protein_g),
        ("carbs_g", averages.carbs_g, recommended.carbs_g),
        ("fat_g", averages.fat_g, recommended.fat_g),
    ]

    for nutrient, avg, rec in macro_checks:
        if rec > 0 and avg < rec:
            deficit = (rec - avg) / rec * 100
            gaps.append(NutritionGap(
                nutrient=nutrient,
                average_intake=avg,
                recommended_value=rec,
                deficit_percentage=deficit,
            ))

    # Check micro nutrients
    for nutrient, rec_value in recommended.micro_nutrients.items():
        avg_value = averages.micro_nutrients.get(nutrient, 0.0)
        if rec_value > 0 and avg_value < rec_value:
            deficit = (rec_value - avg_value) / rec_value * 100
            gaps.append(NutritionGap(
                nutrient=nutrient,
                average_intake=avg_value,
                recommended_value=rec_value,
                deficit_percentage=deficit,
            ))

    return gaps


# ---------------------------------------------------------------------------
# Service class
# ---------------------------------------------------------------------------

class DietaryAnalysisService:
    """Service layer for dietary trend analysis operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def analyze_trends(
        self,
        user_id: uuid.UUID,
        window_days: int = 7,
    ) -> DietaryTrendReport:
        """Aggregate nutrition entries over a time window (Req 9.1, 9.4).

        Returns daily summaries suitable for chart visualization and
        computed averages with gap analysis.
        """
        end_date = date.today()
        start_date = end_date - timedelta(days=window_days - 1)

        entries = await self._get_entries(user_id, start_date, end_date)

        # Build daily summaries (one per day in the window)
        daily_map: dict[date, DailySummary] = {}
        for d_offset in range(window_days):
            d = start_date + timedelta(days=d_offset)
            daily_map[d] = DailySummary(date=d)

        for entry in entries:
            summary = daily_map.get(entry.entry_date)
            if summary is None:
                summary = DailySummary(date=entry.entry_date)
                daily_map[entry.entry_date] = summary
            summary.calories += entry.calories
            summary.protein_g += entry.protein_g
            summary.carbs_g += entry.carbs_g
            summary.fat_g += entry.fat_g
            micros = entry.micro_nutrients or {}
            for k, v in micros.items():
                summary.micro_nutrients[k] = summary.micro_nutrients.get(k, 0.0) + v

        daily_summaries = sorted(daily_map.values(), key=lambda s: s.date)

        # Compute averages using pure function
        entry_data = [
            NutritionEntryData(
                entry_date=e.entry_date,
                calories=e.calories,
                protein_g=e.protein_g,
                carbs_g=e.carbs_g,
                fat_g=e.fat_g,
                micro_nutrients=e.micro_nutrients,
            )
            for e in entries
        ]
        averages = compute_daily_averages(entry_data, window_days)

        # Detect gaps using pure function
        recommended = RecommendedIntake(
            calories=RECOMMENDED_DAILY_VALUES["calories"],
            protein_g=RECOMMENDED_DAILY_VALUES["protein_g"],
            carbs_g=RECOMMENDED_DAILY_VALUES["carbs_g"],
            fat_g=RECOMMENDED_DAILY_VALUES["fat_g"],
            micro_nutrients={
                k: v for k, v in RECOMMENDED_DAILY_VALUES.items()
                if k not in ("calories", "protein_g", "carbs_g", "fat_g")
            },
        )
        gaps = detect_gaps(averages, recommended)

        return DietaryTrendReport(
            window_days=window_days,
            daily_summaries=daily_summaries,
            averages=averages,
            gaps=gaps,
        )

    async def identify_gaps(
        self,
        user_id: uuid.UUID,
        window_days: int = 7,
    ) -> list[NutritionGap]:
        """Identify nutritional gaps over a time window (Req 9.3)."""
        report = await self.analyze_trends(user_id, window_days)
        return report.gaps

    async def get_recommendations(
        self,
        user_id: uuid.UUID,
        gaps: list[NutritionGap],
    ) -> list[FoodRecommendation]:
        """Suggest foods from the Food_Database to address gaps (Req 9.5).

        Premium-only feature. Returns food items rich in the deficient nutrients.
        """
        from src.modules.food_database.models import FoodItem

        recommendations: list[FoodRecommendation] = []

        # Map gap nutrients to food database micro_nutrient keys
        for gap in gaps[:5]:  # Limit to top 5 gaps
            nutrient = gap.nutrient

            # Search food items that have this nutrient in micro_nutrients
            stmt = select(FoodItem).where(FoodItem.deleted_at.is_(None)).limit(3)
            result = await self.session.execute(stmt)
            foods = list(result.scalars().all())

            for food in foods:
                micros = food.micro_nutrients or {}
                amount = micros.get(nutrient, 0.0)
                if amount > 0:
                    recommendations.append(FoodRecommendation(
                        nutrient=nutrient,
                        food_name=food.name,
                        nutrient_amount_per_serving=amount,
                        serving_size=f"{food.serving_size} {food.serving_unit}",
                    ))

        return recommendations

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_entries(
        self,
        user_id: uuid.UUID,
        start_date: date,
        end_date: date,
    ) -> list[NutritionEntry]:
        """Fetch nutrition entries for a date range."""
        stmt = (
            select(NutritionEntry)
            .where(NutritionEntry.user_id == user_id)
            .where(NutritionEntry.entry_date >= start_date)
            .where(NutritionEntry.entry_date <= end_date)
        )
        stmt = NutritionEntry.not_deleted(stmt)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
