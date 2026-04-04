"""Auth module SQLAlchemy models."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import JSONB
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
        String(320), index=True, nullable=False
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

    # Email verification
    email_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    # Trial fields
    has_used_trial: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    trial_started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    trial_ends_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    
    # Session invalidation on password change
    password_changed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )

    # Metadata for OAuth linking and extensibility
    # Use metadata_ to avoid shadowing DeclarativeBase.metadata
    metadata_: Mapped[Optional[dict]] = mapped_column(
        "metadata", JSONB, nullable=True, server_default=text("NULL")
    )

    __table_args__ = (
        Index("ix_users_auth_provider_id", "auth_provider", "auth_provider_id"),
        Index(
            "ix_users_email_active",
            "email",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class PasswordResetCode(Base):
    """Password reset codes table.

    Stores hashed 6-digit OTP codes for password reset with expiry.
    Same pattern as EmailVerificationCode.
    """

    __tablename__ = "password_reset_codes"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    code_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class TokenBlacklist(Base):
    """JWT token blacklist table.
    
    Stores JTI (JWT ID) of tokens that have been logged out.
    """

    __tablename__ = "token_blacklist"

    jti: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class EmailVerificationCode(Base):
    """Email verification codes table.

    Stores hashed OTP codes for email verification with expiry.
    """

    __tablename__ = "email_verification_codes"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    code_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
