"""Auth module Pydantic request/response schemas."""

import uuid

from pydantic import BaseModel, EmailStr, Field

from src.shared.types import UserRole


class RegisterRequest(BaseModel):
    """Email/password registration payload."""

    email: EmailStr
    password: str = Field(min_length=8, description="Minimum 8 characters")


class LoginRequest(BaseModel):
    """Email/password login payload."""

    email: EmailStr
    password: str


class OAuthCallbackRequest(BaseModel):
    """OAuth provider callback payload."""

    provider: str = Field(description="OAuth provider name (google, apple)")
    token: str = Field(description="OAuth access/id token from provider")


class AuthTokensResponse(BaseModel):
    """JWT token pair returned on successful authentication."""

    access_token: str
    refresh_token: str
    expires_in: int = Field(description="Access token TTL in seconds")
    token_type: str = "bearer"


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

    token: str
    new_password: str = Field(min_length=8, description="Minimum 8 characters")

