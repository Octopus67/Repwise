"""Auth routes — registration, login, OAuth, token refresh, and logout."""

import time

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
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
    RegisterResponse,
    ResetPasswordRequest,
    ResendVerificationRequest,
    VerifyEmailRequest,
)
from src.modules.auth.service import AuthService
from src.shared.errors import ApiError, RateLimitedError, UnauthorizedError, ValidationError

router = APIRouter()

# In-memory rate limiter for verify-email: user_id -> list of timestamps
_verify_attempts: dict[str, list[float]] = {}
VERIFY_MAX_ATTEMPTS = 5
VERIFY_WINDOW_SECONDS = 900  # 15 minutes


def _check_verify_rate_limit(user_id: str) -> None:
    """Raise RateLimitedError if user exceeded 5 verify attempts in 15 min."""
    now = time.time()
    cutoff = now - VERIFY_WINDOW_SECONDS
    attempts = _verify_attempts.get(user_id, [])
    attempts = [t for t in attempts if t > cutoff]
    _verify_attempts[user_id] = attempts
    if len(attempts) >= VERIFY_MAX_ATTEMPTS:
        raise RateLimitedError(
            message="Too many verification attempts. Please try again later.",
            retry_after=VERIFY_WINDOW_SECONDS,
        )
    attempts.append(now)
    _verify_attempts[user_id] = attempts


def clear_verify_attempts() -> None:
    """Clear all verify rate limit state. Useful for testing."""
    _verify_attempts.clear()


def _get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(db)


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(
    data: RegisterRequest,
    service: AuthService = Depends(_get_auth_service),
) -> RegisterResponse:
    """Register a new user with email and password.

    Returns tokens on success, or a generic message if the email is taken
    (to prevent enumeration). An 'account exists' email is sent silently.
    """
    tokens = await service.register_email(email=data.email, password=data.password)
    if tokens is None:
        # Email already exists — return generic message, no tokens
        return RegisterResponse(
            message="If this email is not already registered, a verification code has been sent.",
        )
    return RegisterResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
        message="Registration successful. Please verify your email.",
    )


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
    except ApiError:
        # EMAIL_NOT_VERIFIED — don't record as failed attempt
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
    request: Request,
    user: User = Depends(get_current_user),
    service: AuthService = Depends(_get_auth_service),
) -> None:
    """Logout the current user (invalidate tokens server-side)."""
    from src.middleware.authenticate import _extract_bearer_token
    token = _extract_bearer_token(request)
    await service.logout(token)


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
    """Request a password reset OTP code via email.

    Always returns 200 regardless of whether the email exists,
    to avoid leaking account information.
    """
    await service.generate_reset_code(email=data.email)
    return {
        "message": "If an account exists with that email, a reset code has been sent"
    }


@router.post("/reset-password")
async def reset_password(
    data: ResetPasswordRequest,
    service: AuthService = Depends(_get_auth_service),
) -> dict:
    """Reset password using a valid 6-digit OTP code."""
    success = await service.reset_password(
        email=data.email, code=data.code, new_password=data.new_password
    )
    if not success:
        raise ValidationError("Invalid or expired reset code")
    return {"message": "Password has been reset"}


@router.post("/verify-email")
async def verify_email(
    data: VerifyEmailRequest,
    user: User = Depends(get_current_user),
    service: AuthService = Depends(_get_auth_service),
) -> dict:
    """Verify the user's email with a 6-digit OTP code."""
    if user.email_verified:
        return {"message": "Email already verified"}

    _check_verify_rate_limit(str(user.id))

    success = await service.verify_email(user_id=user.id, code=data.code)
    if not success:
        raise ValidationError("Invalid or expired verification code")
    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
async def resend_verification(
    user: User = Depends(get_current_user),
    service: AuthService = Depends(_get_auth_service),
) -> dict:
    """Resend the email verification code. Rate limited to 3 per 15 minutes."""
    if user.email_verified:
        return {"message": "Email already verified"}

    await service.resend_verification_code(user)
    return {"message": "Verification code sent"}
