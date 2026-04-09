"""Sharing models — tracks share events and referrals."""

from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.base_model import Base


class ShareEvent(Base):
    __tablename__ = "share_events"

    # id, created_at, updated_at inherited from Base
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("training_sessions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    share_type: Mapped[str] = mapped_column(String(32), nullable=False, default="workout")
    platform: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)


class Referral(Base):
    __tablename__ = "referrals"

    # id, created_at, updated_at inherited from Base
    referrer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    visitor_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
