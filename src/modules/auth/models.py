"""Auth module SQLAlchemy models."""

import uuid

from sqlalchemy import Index, String
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.base_model import Base
from src.shared.soft_delete import SoftDeleteMixin
from src.shared.types import AuthProvider, UserRole
from typing import Optional


class User(SoftDeleteMixin, Base):
    """Users table.

    Stores authentication credentials and role information.
    Supports email/password and OAuth (Google, Apple) login.
    """

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(320), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True
    )
    auth_provider: Mapped[str] = mapped_column(
        String(20), nullable=False, default=AuthProvider.EMAIL
    )
    auth_provider_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, default=UserRole.USER
    )

    __table_args__ = (
        Index("ix_users_auth_provider_id", "auth_provider", "auth_provider_id"),
    )
