"""Auth module Pydantic request/response schemas."""

import re
import uuid
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from src.shared.types import UserRole


class RegisterRequest(BaseModel):
    """Email/password registration payload."""

    email: EmailStr
    password: str = Field(min_length=8, description="Minimum 8 characters")

    @field_validator("password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    """Email/password login payload."""

    email: EmailStr
    password: str


class OAuthCallbackRequest(BaseModel):
    """OAuth provider callback payload."""

    provider: str = Field(default="", description="OAuth provider name (google, apple)")
    token: Optional[str] = Field(default=None, description="OAuth access/id token from provider")
    identity_token: Optional[str] = Field(default=None, description="Apple identity token (alias for token)")

    @model_validator(mode="after")
    def resolve_token(self) -> "OAuthCallbackRequest":
        """Accept either 'token' or 'identity_token', preferring identity_token for Apple."""
        if self.identity_token and not self.token:
            self.token = self.identity_token
        if not self.token:
            raise ValueError("Either 'token' or 'identity_token' must be provided")
        return self


class AuthTokensResponse(BaseModel):
    """JWT token pair returned on successful authentication."""

    access_token: str
    refresh_token: str
    expires_in: int = Field(description="Access token TTL in seconds")
    token_type: str = "bearer"


class RegisterResponse(BaseModel):
    """Registration response — tokens on success, generic message on duplicate."""

    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None
    token_type: str = "bearer"
    message: str


class RefreshTokenRequest(BaseModel):
    """Refresh token request payload."""

    refresh_token: str


class UserResponse(BaseModel):
    """Public user representation."""

    id: uuid.UUID
    email: str
    role: UserRole

    model_config = {"from_attributes": True}

class ForgotPasswordRequest(BaseModel):
    """Forgot password request payload."""

    email: str


class ResetPasswordRequest(BaseModel):
    """Reset password request payload."""

    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, description="Minimum 8 characters")

    @field_validator("new_password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v



class VerifyEmailRequest(BaseModel):
    """Email verification payload."""

    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ResendVerificationRequest(BaseModel):
    """Resend verification code payload."""

    email: EmailStr
