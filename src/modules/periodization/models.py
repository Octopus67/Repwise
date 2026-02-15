"""Periodization module SQLAlchemy models."""

import uuid
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.audit import AuditLogMixin
from src.shared.base_model import Base
from src.shared.soft_delete import SoftDeleteMixin
from typing import Optional


class TrainingBlock(SoftDeleteMixin, AuditLogMixin, Base):
    """Training blocks table.

    Stores user-defined training periods with phase type, date range,
    and optional nutrition phase alignment.
    """

    __tablename__ = "training_blocks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    phase_type: Mapped[str] = mapped_column(String(20), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    nutrition_phase: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "end_date >= start_date", name="ck_training_blocks_date_range"
        ),
        Index("ix_training_blocks_user_dates", "user_id", "start_date", "end_date"),
        Index(
            "ix_training_blocks_not_deleted",
            "deleted_at",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
