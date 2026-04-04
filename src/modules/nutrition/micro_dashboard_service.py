"""Micronutrient dashboard service — weekly aggregation and scoring.

Provides consolidated weekly micronutrient views with:
- Daily averages for all 27 tracked nutrients
- RDA percentage calculations
- Nutrient quality score (0-100)
- Deficiency highlights (nutrients consistently below 50% RDA)
- Top food contributors per nutrient
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.nutrition.models import NutritionEntry


# ─── RDA Values (server-side, matching frontend rdaValues.ts) ─────────────────

RDA_VALUES: dict[str, dict[str, float]] = {
    "vitamin_a_mcg":       {"male": 900, "female": 700},
    "vitamin_c_mg":        {"male": 90, "female": 75},
    "vitamin_d_mcg":       {"male": 15, "female": 15},
    "vitamin_e_mg":        {"male": 15, "female": 15},
    "vitamin_k_mcg":       {"male": 120, "female": 90},
    "thiamin_mg":          {"male": 1.2, "female": 1.1},
    "riboflavin_mg":       {"male": 1.3, "female": 1.1},
    "niacin_mg":           {"male": 16, "female": 14},
    "pantothenic_acid_mg": {"male": 5, "female": 5},
    "vitamin_b6_mg":       {"male": 1.3, "female": 1.3},
    "biotin_mcg":          {"male": 30, "female": 30},
    "folate_mcg":          {"male": 400, "female": 400},
    "vitamin_b12_mcg":     {"male": 2.4, "female": 2.4},
    "calcium_mg":          {"male": 1000, "female": 1000},
    "iron_mg":             {"male": 8, "female": 18},
    "zinc_mg":             {"male": 11, "female": 8},
    "magnesium_mg":        {"male": 400, "female": 310},
    "potassium_mg":        {"male": 3400, "female": 2600},
    "selenium_mcg":        {"male": 55, "female": 55},
    "sodium_mg":           {"male": 2300, "female": 2300},
    "phosphorus_mg":       {"male": 700, "female": 700},
    "manganese_mg":        {"male": 2.3, "female": 1.8},
    "copper_mg":           {"male": 0.9, "female": 0.9},
    "omega_3_g":           {"male": 1.6, "female": 1.1},
    "omega_6_g":           {"male": 17, "female": 12},
    "cholesterol_mg":      {"male": 300, "female": 300},
    "fibre_g":             {"male": 38, "female": 25},
}


# ─── Data Classes ─────────────────────────────────────────────────────────────


@dataclass
class NutrientSummary:
    """Summary for a single nutrient over a time window."""
    key: str
    label: str
    unit: str
    group: str
    daily_average: float
    rda: float
    rda_pct: float  # 0-100+
    status: str  # "deficient" (<50%), "low" (50-79%), "adequate" (80-119%), "excess" (120%+)
    has_data: bool = True  # False if no food in the period had this nutrient


@dataclass
class DeficiencyAlert:
    """A nutrient consistently below threshold."""
    key: str
    label: str
    daily_average: float
    rda: float
    deficit_pct: float
    days_below_50pct: int
    total_days: int


@dataclass
class MicronutrientDashboard:
    """Complete weekly/period micronutrient dashboard."""
    start_date: date
    end_date: date
    days_tracked: int
    days_with_data: int
    nutrient_score: float  # 0-100
    nutrients_with_data: int  # how many of 27 nutrients had actual intake data
    total_nutrients: int  # always 27
    nutrients: list[NutrientSummary]
    deficiencies: list[DeficiencyAlert]
    top_nutrients: list[NutrientSummary]
    worst_nutrients: list[NutrientSummary]


# ─── Nutrient Metadata ────────────────────────────────────────────────────────

NUTRIENT_META: dict[str, tuple[str, str, str]] = {
    "vitamin_a_mcg": ("Vitamin A", "mcg", "vitamins"),
    "vitamin_c_mg": ("Vitamin C", "mg", "vitamins"),
    "vitamin_d_mcg": ("Vitamin D", "mcg", "vitamins"),
    "vitamin_e_mg": ("Vitamin E", "mg", "vitamins"),
    "vitamin_k_mcg": ("Vitamin K", "mcg", "vitamins"),
    "thiamin_mg": ("Thiamin (B1)", "mg", "vitamins"),
    "riboflavin_mg": ("Riboflavin (B2)", "mg", "vitamins"),
    "niacin_mg": ("Niacin (B3)", "mg", "vitamins"),
    "pantothenic_acid_mg": ("Pantothenic Acid (B5)", "mg", "vitamins"),
    "vitamin_b6_mg": ("Vitamin B6", "mg", "vitamins"),
    "biotin_mcg": ("Biotin (B7)", "mcg", "vitamins"),
    "folate_mcg": ("Folate (B9)", "mcg", "vitamins"),
    "vitamin_b12_mcg": ("Vitamin B12", "mcg", "vitamins"),
    "calcium_mg": ("Calcium", "mg", "minerals"),
    "iron_mg": ("Iron", "mg", "minerals"),
    "zinc_mg": ("Zinc", "mg", "minerals"),
    "magnesium_mg": ("Magnesium", "mg", "minerals"),
    "potassium_mg": ("Potassium", "mg", "minerals"),
    "selenium_mcg": ("Selenium", "mcg", "minerals"),
    "sodium_mg": ("Sodium", "mg", "minerals"),
    "phosphorus_mg": ("Phosphorus", "mg", "minerals"),
    "manganese_mg": ("Manganese", "mg", "minerals"),
    "copper_mg": ("Copper", "mg", "minerals"),
    "omega_3_g": ("Omega-3", "g", "fatty_acids"),
    "omega_6_g": ("Omega-6", "g", "fatty_acids"),
    "cholesterol_mg": ("Cholesterol", "mg", "other"),
    "fibre_g": ("Fibre", "g", "other"),
}


# ─── Pure Functions ───────────────────────────────────────────────────────────


def _classify_status(rda_pct: float) -> str:
    if rda_pct < 50:
        return "deficient"
    if rda_pct < 80:
        return "low"
    if rda_pct < 120:
        return "adequate"
    return "excess"


def compute_nutrient_score(nutrients: list[NutrientSummary]) -> float:
    """Compute overall nutrient quality score (0-100).

    Score = average of min(rda_pct, 100) across nutrients WITH DATA and RDA > 0.
    Nutrients with no intake data are excluded (not penalized).
    Sodium/cholesterol inverted (lower is better).
    """
    if not nutrients:
        return 0.0

    scores = []
    for n in nutrients:
        if n.rda <= 0 or not n.has_data:
            continue
        if n.key == "sodium_mg":
            scores.append(max(0, min(100, 100 - max(0, n.rda_pct - 100))))
        elif n.key == "cholesterol_mg":
            scores.append(max(0, min(100, 100 - max(0, n.rda_pct - 100))))
        else:
            scores.append(min(n.rda_pct, 100))

    return round(sum(scores) / len(scores), 1) if scores else 0.0


def aggregate_micros(
    entries: list[dict],
    num_days: int,
    sex: str,
) -> list[NutrientSummary]:
    """Aggregate micronutrient entries into daily averages with RDA comparison."""
    totals: dict[str, float] = defaultdict(float)
    seen_keys: set[str] = set()

    for entry in entries:
        micros = entry.get("micro_nutrients") or {}
        for key, val in micros.items():
            if isinstance(val, (int, float)) and key in NUTRIENT_META:
                totals[key] += val
                seen_keys.add(key)

    results = []
    for key, (label, unit, group) in NUTRIENT_META.items():
        daily_avg = totals.get(key, 0.0) / max(num_days, 1)
        rda_entry = RDA_VALUES.get(key, {})
        rda = rda_entry.get(sex, rda_entry.get("male", 0))
        has_data = key in seen_keys
        rda_pct = (daily_avg / rda * 100) if rda > 0 and has_data else 0.0

        results.append(NutrientSummary(
            key=key,
            label=label,
            unit=unit,
            group=group,
            daily_average=round(daily_avg, 2),
            rda=rda,
            rda_pct=round(rda_pct, 1),
            status=_classify_status(rda_pct) if has_data else "no_data",
            has_data=has_data,
        ))

    return results


def detect_deficiencies(
    daily_micros: list[dict[str, float]],
    sex: str,
    threshold_pct: float = 50.0,
) -> list[DeficiencyAlert]:
    """Detect nutrients consistently below threshold across multiple days."""
    alerts = []

    for key, (label, unit, group) in NUTRIENT_META.items():
        rda_entry = RDA_VALUES.get(key, {})
        rda = rda_entry.get(sex, rda_entry.get("male", 0))
        if rda <= 0 or key in ("sodium_mg", "cholesterol_mg"):
            continue

        days_below = 0
        total_intake = 0.0
        total_days = len(daily_micros)

        for day_micros in daily_micros:
            intake = day_micros.get(key, 0.0)
            total_intake += intake
            if (intake / rda * 100) < threshold_pct:
                days_below += 1

        if total_days > 0 and days_below >= total_days * 0.5:
            daily_avg = total_intake / total_days
            deficit_pct = (rda - daily_avg) / rda * 100 if rda > 0 else 0
            alerts.append(DeficiencyAlert(
                key=key,
                label=label,
                daily_average=round(daily_avg, 2),
                rda=rda,
                deficit_pct=round(deficit_pct, 1),
                days_below_50pct=days_below,
                total_days=total_days,
            ))

    return sorted(alerts, key=lambda a: a.deficit_pct, reverse=True)


# ─── Service ──────────────────────────────────────────────────────────────────


class MicronutrientDashboardService:
    """Computes consolidated micronutrient dashboard from nutrition entries."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_dashboard(
        self,
        user_id: uuid.UUID,
        start_date: date,
        end_date: date,
        sex: str = "male",
    ) -> MicronutrientDashboard:
        stmt = (
            select(
                NutritionEntry.entry_date,
                NutritionEntry.calories,
                NutritionEntry.micro_nutrients,
            )
            .where(
                and_(
                    NutritionEntry.user_id == user_id,
                    NutritionEntry.entry_date >= start_date,
                    NutritionEntry.entry_date <= end_date,
                )
            )
            .order_by(NutritionEntry.entry_date)
        )
        # Filter soft-deleted entries
        stmt = NutritionEntry.not_deleted(stmt)

        result = await self.session.execute(stmt)
        rows = result.all()

        num_days = (end_date - start_date).days + 1
        days_with_data = len({r.entry_date for r in rows})

        entries = [
            {"micro_nutrients": r.micro_nutrients}
            for r in rows
        ]

        # Aggregate per-day micros for deficiency detection
        daily_micros: dict[date, dict[str, float]] = defaultdict(lambda: defaultdict(float))
        for r in rows:
            if r.micro_nutrients:
                for k, v in r.micro_nutrients.items():
                    if isinstance(v, (int, float)):
                        daily_micros[r.entry_date][k] += v

        nutrients = aggregate_micros(entries, num_days, sex)
        deficiencies = detect_deficiencies(list(daily_micros.values()), sex)

        # If no nutrition data was logged, score is 0 (not misleading partial score)
        if days_with_data == 0:
            score = 0.0
        else:
            score = compute_nutrient_score(nutrients)

        nutrients_with_data = sum(1 for n in nutrients if n.has_data)

        sorted_by_rda = sorted(nutrients, key=lambda n: n.rda_pct, reverse=True)
        top_5 = [n for n in sorted_by_rda if n.rda > 0 and n.has_data and n.key not in ("sodium_mg", "cholesterol_mg")][:5]
        worst_5 = [n for n in reversed(sorted_by_rda) if n.rda > 0 and n.has_data and n.key not in ("sodium_mg", "cholesterol_mg")][:5]

        return MicronutrientDashboard(
            start_date=start_date,
            end_date=end_date,
            days_tracked=num_days,
            days_with_data=days_with_data,
            nutrient_score=score,
            nutrients_with_data=nutrients_with_data,
            total_nutrients=len(NUTRIENT_META),
            nutrients=nutrients,
            deficiencies=deficiencies,
            top_nutrients=top_5,
            worst_nutrients=worst_5,
        )
