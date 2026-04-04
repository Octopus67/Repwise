"""Export service — generates JSON, CSV, and PDF exports of user data.

GDPR Article 20: Right to data portability.
"""

from __future__ import annotations

import csv
import io
import json
import logging
import uuid
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.export.models import ExportRequest
from src.config.settings import settings
from src.shared.errors import NotFoundError, RateLimitedError, UnprocessableError

logger = logging.getLogger(__name__)

EXPORTS_DIR = Path("exports")
EXPORT_EXPIRY_DAYS = 7
RATE_LIMIT_HOURS = 24


class ExportService:
    """Handles data export requests and generation."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def request_export(self, user_id: uuid.UUID, fmt: str) -> ExportRequest:
        """Create a new export request after rate-limit check."""
        await self._check_rate_limit(user_id)

        now = datetime.utcnow()
        export = ExportRequest(
            user_id=user_id,
            format=fmt,
            status="pending",
            requested_at=now,
        )
        self.session.add(export)
        await self.session.flush()
        return export

    async def get_export(self, export_id: uuid.UUID, user_id: uuid.UUID) -> ExportRequest:
        """Get an export request, verifying ownership."""
        stmt = select(ExportRequest).where(
            ExportRequest.id == export_id, ExportRequest.user_id == user_id
        )
        result = await self.session.execute(stmt)
        export = result.scalar_one_or_none()
        if export is None:
            raise NotFoundError("Export request not found")
        return export

    async def get_history(self, user_id: uuid.UUID) -> list[ExportRequest]:
        """List all export requests for a user, newest first."""
        stmt = (
            select(ExportRequest)
            .where(ExportRequest.user_id == user_id)
            .order_by(ExportRequest.requested_at.desc())
            .limit(100)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def delete_export(self, export_id: uuid.UUID, user_id: uuid.UUID) -> None:
        """Delete an export request and its file."""
        export = await self.get_export(export_id, user_id)
        # Remove file if exists
        if export.download_url:
            path = Path(export.download_url)
            if path.exists():
                path.unlink(missing_ok=True)
        await self.session.delete(export)
        await self.session.flush()

    async def mark_downloaded(self, export_id: uuid.UUID, user_id: uuid.UUID) -> ExportRequest:
        """Mark an export as downloaded."""
        export = await self.get_export(export_id, user_id)
        if export.status != "completed":
            raise UnprocessableError("Export is not ready for download")
        if export.expires_at and datetime.utcnow() > export.expires_at:
            raise UnprocessableError("Export has expired")
        export.downloaded_at = datetime.utcnow()
        await self.session.flush()
        return export

    # ------------------------------------------------------------------
    # Generation methods (called by background worker)
    # ------------------------------------------------------------------

    async def generate_export(self, export_id: uuid.UUID) -> None:
        """Generate the export file based on format."""
        stmt = select(ExportRequest).where(ExportRequest.id == export_id)
        result = await self.session.execute(stmt)
        export = result.scalar_one_or_none()
        if export is None:
            return

        export.status = "processing"
        await self.session.flush()

        try:
            user_data = await self._collect_user_data(export.user_id)
            user_dir = EXPORTS_DIR / str(export.user_id)
            user_dir.mkdir(parents=True, exist_ok=True)

            if export.format == "json":
                path = await self._generate_json_export(user_data, user_dir, export.id)
            elif export.format == "csv":
                path = await self._generate_csv_export(user_data, user_dir, export.id)
            elif export.format == "pdf":
                path = await self._generate_pdf_export(user_data, user_dir, export.id)
            else:
                raise ValueError(f"Unknown format: {export.format}")

            now = datetime.utcnow()
            export.status = "completed"
            export.download_url = str(path)
            export.file_size_bytes = path.stat().st_size
            export.completed_at = now
            export.expires_at = now + timedelta(days=EXPORT_EXPIRY_DAYS)
            await self.session.flush()

        except (SQLAlchemyError, ValueError, OSError, IOError) as exc:
            logger.exception("Export generation failed for %s", export_id)
            export.status = "failed"
            export.error_message = str(exc)[:500]
            await self.session.flush()

    async def _generate_json_export(
        self, data: dict[str, Any], user_dir: Path, export_id: uuid.UUID
    ) -> Path:
        """Generate a JSON export file."""
        path = user_dir / f"{export_id}.json"
        with open(path, "w") as f:
            json.dump(data, f, indent=2, default=str)
        return path

    async def _generate_csv_export(
        self, data: dict[str, Any], user_dir: Path, export_id: uuid.UUID
    ) -> Path:
        """Generate a ZIP of CSVs, one per data category."""
        zip_path = user_dir / f"{export_id}.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            # README
            readme = (
                "Repwise Data Export\n"
                f"Generated: {datetime.utcnow().isoformat()}\n\n"
                "This archive contains your personal data in CSV format.\n"
                "Each file corresponds to a data category.\n"
            )
            zf.writestr("README.txt", readme)

            for category, rows in data.items():
                if not rows:
                    continue
                buf = io.StringIO()
                if isinstance(rows, dict):
                    writer = csv.DictWriter(buf, fieldnames=rows.keys())
                    writer.writeheader()
                    writer.writerow(rows)
                elif isinstance(rows, list) and isinstance(rows[0], dict):
                    writer = csv.DictWriter(buf, fieldnames=rows[0].keys())
                    writer.writeheader()
                    writer.writerows(rows)
                else:
                    continue
                zf.writestr(f"{category}.csv", buf.getvalue())

        return zip_path

    async def _generate_pdf_export(
        self, data: dict[str, Any], user_dir: Path, export_id: uuid.UUID
    ) -> Path:
        """Generate a PDF report. Uses reportlab if available, falls back to text."""
        path = user_dir / f"{export_id}.pdf"
        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.units import cm
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.lib import colors as rl_colors

            doc = SimpleDocTemplate(str(path), pagesize=A4)
            styles = getSampleStyleSheet()
            elements = []

            elements.append(Paragraph("Repwise — Data Export Report", styles["Title"]))
            elements.append(Spacer(1, 0.5 * cm))
            elements.append(
                Paragraph(
                    f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
                    styles["Normal"],
                )
            )
            elements.append(Spacer(1, 1 * cm))

            # Profile section
            if "profile" in data and data["profile"]:
                elements.append(Paragraph("Profile", styles["Heading2"]))
                profile = data["profile"]
                for key, val in profile.items():
                    elements.append(Paragraph(f"<b>{key}</b>: {val}", styles["Normal"]))
                elements.append(Spacer(1, 0.5 * cm))

            # Summary stats for list categories
            for category in ["sessions", "nutrition_entries", "measurements", "achievements"]:
                rows = data.get(category, [])
                if rows and isinstance(rows, list):
                    elements.append(Paragraph(f"{category.replace('_', ' ').title()} ({len(rows)} records)", styles["Heading2"]))
                    # Show first 5 rows as a table
                    if isinstance(rows[0], dict):
                        headers = list(rows[0].keys())[:6]
                        table_data = [headers]
                        for row in rows[:5]:
                            table_data.append([str(row.get(h, ""))[:30] for h in headers])
                        t = Table(table_data)
                        t.setStyle(TableStyle([
                            ("BACKGROUND", (0, 0), (-1, 0), rl_colors.grey),
                            ("TEXTCOLOR", (0, 0), (-1, 0), rl_colors.whitesmoke),
                            ("FONTSIZE", (0, 0), (-1, -1), 7),
                            ("GRID", (0, 0), (-1, -1), 0.5, rl_colors.black),
                        ]))
                        elements.append(t)
                    elements.append(Spacer(1, 0.5 * cm))

            doc.build(elements)
        except ImportError:
            # Fallback: write a plain text file with .pdf extension
            with open(path, "w") as f:
                f.write("Repwise Data Export Report\n")
                f.write(f"Generated: {datetime.utcnow().isoformat()}\n\n")
                for category, rows in data.items():
                    if isinstance(rows, list):
                        f.write(f"\n{category}: {len(rows)} records\n")
                    elif isinstance(rows, dict):
                        f.write(f"\n{category}:\n")
                        for k, v in rows.items():
                            f.write(f"  {k}: {v}\n")
        return path

    # ------------------------------------------------------------------
    # Data collection
    # ------------------------------------------------------------------

    async def _collect_user_data(self, user_id: uuid.UUID) -> dict[str, Any]:
        """Collect all user data for export."""
        data: dict[str, Any] = {}

        # Profile
        from src.modules.user.models import UserProfile
        stmt = select(UserProfile).where(UserProfile.user_id == user_id)
        result = await self.session.execute(stmt)
        profile = result.scalar_one_or_none()
        if profile:
            data["profile"] = {
                "display_name": profile.display_name,
                "height_cm": profile.height_cm,
                "weight_kg": profile.weight_kg,
                "age": profile.age,
                "sex": profile.sex,
                "activity_level": profile.activity_level,
                "goal_type": profile.goal_type,
            }

        # Bodyweight logs
        from src.modules.user.models import BodyweightLog
        stmt = select(BodyweightLog).where(BodyweightLog.user_id == user_id).order_by(BodyweightLog.created_at)
        result = await self.session.execute(stmt)
        data["bodyweight_logs"] = [
            {"weight_kg": r.weight_kg, "recorded_at": str(r.created_at)}
            for r in result.scalars().all()
        ]

        # Training sessions
        from src.modules.training.models import TrainingSession
        stmt = select(TrainingSession).where(
            TrainingSession.user_id == user_id, TrainingSession.deleted_at.is_(None)
        ).order_by(TrainingSession.session_date)
        result = await self.session.execute(stmt)
        data["sessions"] = [
            {
                "date": str(r.session_date),
                "exercises": r.exercises,
            }
            for r in result.scalars().all()
        ]

        # Nutrition entries
        from src.modules.nutrition.models import NutritionEntry
        stmt = select(NutritionEntry).where(
            NutritionEntry.user_id == user_id, NutritionEntry.deleted_at.is_(None)
        ).order_by(NutritionEntry.entry_date)
        result = await self.session.execute(stmt)
        data["nutrition_entries"] = [
            {
                "date": str(r.entry_date),
                "meal_name": r.meal_name,
                "calories": r.calories,
                "protein_g": r.protein_g,
                "carbs_g": r.carbs_g,
                "fat_g": r.fat_g,
            }
            for r in result.scalars().all()
        ]

        # Measurements
        from src.modules.measurements.models import BodyMeasurement
        stmt = select(BodyMeasurement).where(BodyMeasurement.user_id == user_id).order_by(BodyMeasurement.measured_at)
        result = await self.session.execute(stmt)
        data["measurements"] = [
            {
                "measured_at": str(r.measured_at),
                "weight_kg": r.weight_kg,
                "body_fat_pct": r.body_fat_pct,
            }
            for r in result.scalars().all()
        ]

        # Progress photos (URLs only)
        from src.modules.progress_photos.models import ProgressPhoto
        stmt = select(ProgressPhoto).where(
            ProgressPhoto.user_id == user_id, ProgressPhoto.deleted_at.is_(None)
        )
        result = await self.session.execute(stmt)
        data["progress_photos"] = [
            {"capture_date": str(r.capture_date), "pose_type": r.pose_type, "url": f"{settings.CDN_BASE_URL}/{r.r2_key}"}
            for r in result.scalars().all()
        ]

        # Achievements
        from src.modules.achievements.models import UserAchievement
        stmt = select(UserAchievement).where(UserAchievement.user_id == user_id)
        result = await self.session.execute(stmt)
        data["achievements"] = [
            {"achievement_id": r.achievement_id, "unlocked_at": str(r.unlocked_at)}
            for r in result.scalars().all()
        ]

        # Goals
        from src.modules.user.models import UserGoal
        stmt = select(UserGoal).where(UserGoal.user_id == user_id)
        result = await self.session.execute(stmt)
        data["goals"] = [
            {"goal_type": r.goal_type, "target_weight_kg": r.target_weight_kg, "goal_rate_per_week": r.goal_rate_per_week}
            for r in result.scalars().all()
        ]

        return data

    # ------------------------------------------------------------------
    # Rate limiting
    # ------------------------------------------------------------------

    async def _check_rate_limit(self, user_id: uuid.UUID) -> None:
        """Enforce max 1 export per 24 hours."""
        cutoff = datetime.utcnow() - timedelta(hours=RATE_LIMIT_HOURS)
        stmt = select(func.count()).select_from(ExportRequest).where(
            ExportRequest.user_id == user_id,
            ExportRequest.requested_at >= cutoff,
            ExportRequest.status.in_(["pending", "processing", "completed"]),
        )
        result = await self.session.execute(stmt)
        count = result.scalar_one()
        if count > 0:
            raise RateLimitedError(
                message="You can only request one data export per 24 hours.",
                retry_after=RATE_LIMIT_HOURS * 3600,
            )
