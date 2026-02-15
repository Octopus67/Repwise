"""Progress photo SQLAlchemy model.

Stores metadata only — actual photo files live on-device.
"""

import uuid
from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Index, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.base_model import Base
from src.shared.soft_delete import SoftDeleteMixin
from typing import Optional


class ProgressPhoto(SoftDeleteMixin, Base):
    """Metadata for a user's progress photo.

    Photos are stored on-device via expo-file-system. The server stores
    only metadata (capture date, bodyweight, pose type, notes, alignment data).
    The client maintains a local mapping of photo_id → file_uri in AsyncStorage.
    """

    __tablename__ = "progress_photos"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    capture_date: Mapped[date] = mapped_column(Date, nullable=False)
    bodyweight_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pose_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default="front_relaxed",
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    alignment_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        Index("ix_progress_photos_user_date", "user_id", "capture_date"),
    )
