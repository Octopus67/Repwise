"""DB-backed rate limit tracking for critical auth endpoints."""

from sqlalchemy import Index, String
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.base_model import Base


class RateLimitEntry(Base):
    __tablename__ = "rate_limit_entries"

    key: Mapped[str] = mapped_column(String(255), nullable=False)
    endpoint: Mapped[str] = mapped_column(String(50), nullable=False)

    __table_args__ = (
        Index("ix_rate_limit_key_created", "key", "created_at"),
    )
