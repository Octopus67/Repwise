"""Volume landmark SQLAlchemy model."""

import uuid

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.base_model import Base


class UserVolumeLandmark(Base):
    """User-customized volume landmark thresholds per muscle group."""

    __tablename__ = "user_volume_landmarks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=False
    )
    muscle_group: Mapped[str] = mapped_column(String(50), nullable=False)
    mev: Mapped[int] = mapped_column(nullable=False)
    mav: Mapped[int] = mapped_column(nullable=False)
    mrv: Mapped[int] = mapped_column(nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "muscle_group", name="uq_user_muscle_landmark"),
    )
