"""Founder module SQLAlchemy models.

Table: FounderContent — stores localized founder story content in JSONB.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.audit import AuditLogMixin
from src.shared.base_model import Base


class FounderContent(AuditLogMixin, Base):
    """Founder story content block.

    Each row represents a section of the founder story for a given locale.
    The ``content`` JSONB column stores the narrative, timeline, metrics,
    philosophy, and media gallery — supporting future localization
    (Requirement 13.4).

    Attributes
    ----------
    section_key : Identifies the content section (e.g. ``"story"``, ``"gallery"``).
    locale : Language/region code (e.g. ``"en"``, ``"hi"``).
    content : JSONB blob with the actual content payload.
    version : Integer version counter, incremented on each admin update.
    """

    __tablename__ = "founder_content"

    section_key: Mapped[str] = mapped_column(String(100), nullable=False)
    locale: Mapped[str] = mapped_column(String(10), nullable=False, default="en")
    content: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
