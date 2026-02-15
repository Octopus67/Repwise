"""Auth routes — registration, login, OAuth, token refresh, and logout."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.config.settings import settings
from src.middleware.authenticate import get_current_user
from src.middleware.rate_limiter import check_rate_limit, record_attempt, reset_attempts
from src.modules.auth.models import User
from src.modules.auth.schemas import (
    AuthTokensResponse,
    ForgotPasswordRequest,
    LoginRequest,
    OAuthCallbackRequest,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
)
from src.modules.auth.service import AuthService
from src.shared.errors import UnauthorizedError

router = APIRouter()


def _get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(db)


@router.post("/register", response_model=AuthTokensResponse, status_code=201)
async def register(
    data: RegisterRequest,
    service: AuthService = Depends(_get_auth_service),
) -> AuthTokensResponse:
    """Register a new user with email and password."""
    tokens = await service.register_email(email=data.email, password=data.password)
    return tokens


@router.post("/login", response_model=AuthTokensResponse)
async def login(
    data: LoginRequest,
    service: AuthService = Depends(_get_auth_service),
) -> AuthTokensResponse:
    """Authenticate with email and password."""
    check_rate_limit(data.email)
    try:
        tokens = await service.login_email(email=data.email, password=data.password)
    except UnauthorizedError:
        record_attempt(data.email)
        raise
    # Successful login — clear rate limit counter
    reset_attempts(data.email)
    return tokens


@router.post("/oauth/{provider}", response_model=AuthTokensResponse)
async def oauth_login(
    provider: str,
    data: OAuthCallbackRequest,
    service: AuthService = Depends(_get_auth_service),
) -> AuthTokensResponse:
    """Authenticate via OAuth provider (google, apple, etc.)."""
    tokens = await service.login_oauth(provider=provider, token=data.token)
    return tokens


@router.post("/refresh", response_model=AuthTokensResponse)
async def refresh(
    data: RefreshTokenRequest,
    service: AuthService = Depends(_get_auth_service),
) -> AuthTokensResponse:
    """Obtain a new access token using a valid refresh token."""
    tokens = await service.refresh_token(refresh_token=data.refresh_token)
    return tokens


@router.post("/logout", status_code=204, response_model=None)
async def logout(
    user: User = Depends(get_current_user),
    service: AuthService = Depends(_get_auth_service),
) -> None:
    """Logout the current user (invalidate tokens server-side)."""
    await service.logout(user_id=user.id)


@router.get("/me")
async def get_current_user_info(
    user: User = Depends(get_current_user),
) -> dict:
    """Return the current authenticated user's basic info."""
    return {"id": str(user.id), "email": user.email, "role": user.role}


@router.post("/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    service: AuthService = Depends(_get_auth_service),
) -> dict:
    """Request a password reset link.

    Always returns 200 regardless of whether the email exists,
    to avoid leaking account information.
    """
    token = await service.generate_reset_token(email=data.email)
    response: dict = {
        "message": "If an account exists with that email, a reset link has been sent"
    }
    if settings.DEBUG and token is not None:
        response["dev_token"] = token
    return response


@router.post("/reset-password")
async def reset_password(
    data: ResetPasswordRequest,
    service: AuthService = Depends(_get_auth_service),
) -> dict:
    """Reset password using a valid reset token."""
    success = await service.reset_password(token=data.token, new_password=data.new_password)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    return {"message": "Password has been reset"}
