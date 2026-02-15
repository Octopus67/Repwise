"""Business logic for health report operations.

Includes the pure function ``flag_markers`` for classifying markers
against reference ranges (Requirement 8.2).
"""

from __future__ import annotations
from typing import Optional

import uuid
from datetime import date, timedelta, timezone, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.health_reports.models import HealthReport, MarkerReferenceRange
from src.modules.health_reports.schemas import (
    HealthReportCreate,
    MarkerRange,
    MarkerResult,
    NutritionCorrelation,
)
from src.modules.nutrition.models import NutritionEntry
from src.shared.errors import NotFoundError
from src.shared.pagination import PaginatedResult, PaginationParams
from src.shared.types import AuditAction


# ---------------------------------------------------------------------------
# Pure function: flag_markers
# ---------------------------------------------------------------------------

def flag_markers(
    markers: dict[str, float],
    reference_ranges: dict[str, MarkerRange],
) -> dict[str, MarkerResult]:
    """Classify each marker as low/normal/high against reference ranges.

    Pure function — no side effects, no database access.

    For each marker present in both ``markers`` and ``reference_ranges``:
    - ``low``    if value < min_normal
    - ``high``   if value > max_normal
    - ``normal`` if min_normal <= value <= max_normal

    Markers without a matching reference range are skipped.

    **Validates: Requirements 8.2**
    """
    results: dict[str, MarkerResult] = {}
    for name, value in markers.items():
        ref = reference_ranges.get(name)
        if ref is None:
            continue
        if value < ref.min_normal:
            status = "low"
        elif value > ref.max_normal:
            status = "high"
        else:
            status = "normal"
        results[name] = MarkerResult(
            value=value,
            status=status,
            min_normal=ref.min_normal,
            max_normal=ref.max_normal,
        )
    return results


# ---------------------------------------------------------------------------
# Marker-to-nutrient mapping for cross-referencing
# ---------------------------------------------------------------------------

MARKER_NUTRIENT_MAP: dict[str, str] = {
    "hemoglobin": "iron",
    "iron": "iron",
    "vitamin_d": "vitamin_d",
    "vitamin_b12": "vitamin_b12",
    "calcium": "calcium",
}


# ---------------------------------------------------------------------------
# Seed data: standard marker reference ranges
# ---------------------------------------------------------------------------

SEED_MARKER_RANGES: list[dict] = [
    {"marker_name": "total_cholesterol", "unit": "mg/dL", "min_normal": 125.0, "max_normal": 200.0, "category": "lipid_profile"},
    {"marker_name": "ldl", "unit": "mg/dL", "min_normal": 0.0, "max_normal": 100.0, "category": "lipid_profile"},
    {"marker_name": "hdl", "unit": "mg/dL", "min_normal": 40.0, "max_normal": 100.0, "category": "lipid_profile"},
    {"marker_name": "triglycerides", "unit": "mg/dL", "min_normal": 0.0, "max_normal": 150.0, "category": "lipid_profile"},
    {"marker_name": "hemoglobin", "unit": "g/dL", "min_normal": 12.0, "max_normal": 17.5, "category": "blood_count"},
    {"marker_name": "vitamin_d", "unit": "ng/mL", "min_normal": 30.0, "max_normal": 100.0, "category": "vitamins"},
    {"marker_name": "vitamin_b12", "unit": "pg/mL", "min_normal": 200.0, "max_normal": 900.0, "category": "vitamins"},
    {"marker_name": "iron", "unit": "mcg/dL", "min_normal": 60.0, "max_normal": 170.0, "category": "minerals"},
]

SAMPLE_REPORTS: list[dict] = [
    {
        "report_date": date(2024, 1, 15),
        "markers": {
            "total_cholesterol": 185.0,
            "ldl": 110.0,
            "hdl": 55.0,
            "triglycerides": 120.0,
            "hemoglobin": 14.5,
            "vitamin_d": 25.0,
            "vitamin_b12": 450.0,
            "iron": 80.0,
        },
        "is_sample": True,
    },
    {
        "report_date": date(2024, 6, 20),
        "markers": {
            "total_cholesterol": 210.0,
            "ldl": 130.0,
            "hdl": 42.0,
            "triglycerides": 160.0,
            "hemoglobin": 11.5,
            "vitamin_d": 35.0,
            "vitamin_b12": 180.0,
            "iron": 55.0,
        },
        "is_sample": True,
    },
]


# ---------------------------------------------------------------------------
# Service class
# ---------------------------------------------------------------------------

class HealthReportService:
    """Service layer for health report operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upload_report(
        self,
        user_id: uuid.UUID,
        data: HealthReportCreate,
    ) -> HealthReport:
        """Parse, flag markers, and persist a new health report (Req 8.1, 8.2)."""
        # Load reference ranges from DB
        ref_ranges = await self._load_reference_ranges()

        # Flag markers using the pure function
        flagged = flag_markers(
            data.markers,
            {name: MarkerRange(min_normal=r["min_normal"], max_normal=r["max_normal"], unit=r["unit"])
             for name, r in ref_ranges.items()},
        )

        report = HealthReport(
            user_id=user_id,
            report_date=data.report_date,
            markers=data.markers,
            flagged_markers={k: v.model_dump() for k, v in flagged.items()},
            is_sample=False,
            source_file_url=data.source_file_url,
        )
        self.session.add(report)
        await self.session.flush()

        await HealthReport.write_audit(
            self.session,
            user_id=user_id,
            action=AuditAction.CREATE,
            entity_id=report.id,
            changes={"markers": list(data.markers.keys())},
        )

        return report

    async def get_reports(
        self,
        user_id: uuid.UUID,
        pagination: Optional[PaginationParams] = None,
    ) -> PaginatedResult[HealthReport]:
        """Return paginated health reports in chronological order (Req 8.4)."""
        pagination = pagination or PaginationParams()

        base = select(HealthReport).where(HealthReport.user_id == user_id)
        base = HealthReport.not_deleted(base)

        count_stmt = select(func.count()).select_from(base.subquery())
        total_count = (await self.session.execute(count_stmt)).scalar_one()

        items_stmt = (
            base.order_by(HealthReport.report_date.asc(), HealthReport.created_at.asc())
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        result = await self.session.execute(items_stmt)
        items = list(result.scalars().all())

        return PaginatedResult[HealthReport](
            items=items,
            total_count=total_count,
            page=pagination.page,
            limit=pagination.limit,
        )

    async def get_report_detail(
        self,
        user_id: uuid.UUID,
        report_id: uuid.UUID,
    ) -> HealthReport:
        """Fetch a single report by ID (Req 8.4)."""
        stmt = (
            select(HealthReport)
            .where(HealthReport.id == report_id)
            .where(HealthReport.user_id == user_id)
        )
        stmt = HealthReport.not_deleted(stmt)
        result = await self.session.execute(stmt)
        report = result.scalar_one_or_none()
        if report is None:
            raise NotFoundError("Health report not found")
        return report

    async def cross_reference_nutrition(
        self,
        user_id: uuid.UUID,
        report_id: uuid.UUID,
    ) -> list[NutritionCorrelation]:
        """Cross-reference flagged markers with recent nutrition (Req 8.3).

        Looks at the last 30 days of nutrition entries and computes average
        micro-nutrient intake for nutrients related to flagged markers.
        """
        report = await self.get_report_detail(user_id, report_id)
        flagged = report.flagged_markers or {}

        # Only look at abnormal markers
        abnormal_markers = {
            k: v for k, v in flagged.items()
            if isinstance(v, dict) and v.get("status") in ("low", "high")
        }
        if not abnormal_markers:
            return []

        # Get last 30 days of nutrition entries
        cutoff = report.report_date - timedelta(days=30)
        stmt = (
            select(NutritionEntry)
            .where(NutritionEntry.user_id == user_id)
            .where(NutritionEntry.entry_date >= cutoff)
            .where(NutritionEntry.entry_date <= report.report_date)
        )
        stmt = NutritionEntry.not_deleted(stmt)
        result = await self.session.execute(stmt)
        entries = list(result.scalars().all())

        # Compute average micro-nutrient intake
        nutrient_totals: dict[str, float] = {}
        day_count = max(1, len({e.entry_date for e in entries}))
        for entry in entries:
            micros = entry.micro_nutrients or {}
            for nutrient, value in micros.items():
                nutrient_totals[nutrient] = nutrient_totals.get(nutrient, 0.0) + value

        nutrient_averages = {k: v / day_count for k, v in nutrient_totals.items()}

        # Build correlations
        from src.modules.dietary_analysis.service import RECOMMENDED_DAILY_VALUES

        correlations: list[NutritionCorrelation] = []
        for marker_name, marker_data in abnormal_markers.items():
            related_nutrient = MARKER_NUTRIENT_MAP.get(marker_name)
            if related_nutrient is None:
                continue
            avg = nutrient_averages.get(related_nutrient, 0.0)
            rec = RECOMMENDED_DAILY_VALUES.get(related_nutrient, 0.0)
            if rec <= 0:
                continue
            deficit_pct = max(0.0, (rec - avg) / rec * 100)
            correlations.append(NutritionCorrelation(
                marker_name=marker_name,
                marker_status=marker_data.get("status", "unknown"),
                related_nutrient=related_nutrient,
                average_intake=avg,
                recommended_intake=rec,
                deficit_percentage=round(deficit_pct, 2),
            ))

        return correlations

    async def get_sample_reports(self) -> list[dict]:
        """Return pre-built sample/demo reports (Req 8.5)."""
        ref_ranges = await self._load_reference_ranges()
        samples = []
        for sample in SAMPLE_REPORTS:
            flagged = flag_markers(
                sample["markers"],
                {name: MarkerRange(min_normal=r["min_normal"], max_normal=r["max_normal"], unit=r["unit"])
                 for name, r in ref_ranges.items()},
            )
            samples.append({
                "report_date": sample["report_date"].isoformat(),
                "markers": sample["markers"],
                "flagged_markers": {k: v.model_dump() for k, v in flagged.items()},
                "is_sample": True,
            })
        return samples

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _load_reference_ranges(self) -> dict[str, dict]:
        """Load all marker reference ranges from DB, falling back to seed data."""
        stmt = select(MarkerReferenceRange)
        result = await self.session.execute(stmt)
        rows = list(result.scalars().all())

        if rows:
            return {
                r.marker_name: {
                    "min_normal": r.min_normal,
                    "max_normal": r.max_normal,
                    "unit": r.unit,
                    "category": r.category,
                }
                for r in rows
            }

        # Fallback to seed data if DB is empty
        return {
            r["marker_name"]: r for r in SEED_MARKER_RANGES
        }
