"""SQLAlchemy model for feature flags."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, Index, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.base_model import Base


class FeatureFlag(Base):
    """Runtime feature flag with optional conditional evaluation.

    Attributes
    ----------
    flag_name : Unique identifier for the flag (e.g. ``"premium_content"``).
    is_enabled : Global on/off toggle.
    conditions : Optional JSONB conditions for targeted rollout.
        Example: ``{"roles": ["premium"], "regions": ["US"]}``
    description : Human-readable description of what the flag controls.
    updated_at : Inherited from Base — auto-updated on change.
    """

    __tablename__ = "feature_flags"

    flag_name: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False,
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    conditions: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
        server_default=text("NULL"),
    )
    description: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
