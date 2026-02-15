"""SQLAlchemy models for health reports and marker reference ranges."""

from __future__ import annotations
from typing import Optional

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, Float, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.audit import AuditLogMixin
from src.shared.base_model import Base
from src.shared.soft_delete import SoftDeleteMixin


class HealthReport(Base, SoftDeleteMixin, AuditLogMixin):
    """A user's uploaded health/blood report with parsed markers.

    Markers and flagged_markers are stored as JSONB for extensibility
    (Requirement 8.6). New marker types can be added without schema changes.
    """

    __tablename__ = "health_reports"

    user_id: Mapped[uuid.UUID] = mapped_column(index=True)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    markers: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, server_default=text("'{}'::jsonb")
    )
    flagged_markers: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, server_default=text("'{}'::jsonb")
    )
    is_sample: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    source_file_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    __table_args__ = (
        Index("ix_health_reports_user_date", "user_id", report_date.desc()),
        Index(
            "ix_health_reports_not_deleted",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class MarkerReferenceRange(Base):
    """Reference ranges for health markers (e.g., cholesterol, hemoglobin).

    Stored as regular table rows so new markers can be added via data inserts
    without schema migration (Requirement 8.6, 15.5).
    """

    __tablename__ = "marker_reference_ranges"

    marker_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    min_normal: Mapped[float] = mapped_column(Float, nullable=False)
    max_normal: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    metadata_: Mapped[Optional[dict]] = mapped_column(
        "metadata", JSONB, nullable=True, server_default=text("'{}'::jsonb")
    )
