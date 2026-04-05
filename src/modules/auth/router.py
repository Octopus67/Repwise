"""Auth routes — registration, login, OAuth, token refresh, and logout."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Request, Body, Path, Response
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.middleware.rate_limiter import (
    check_rate_limit,
    check_forgot_password_rate_limit,
    check_reset_password_rate_limit,
    check_register_rate_limit,
    check_oauth_rate_limit,
    check_lockout,
    check_login_ip_rate_limit,
    check_user_endpoint_rate_limit,
    record_attempt,
    reset_attempts,
)
from src.config.settings import settings
from src.middleware.db_rate_limiter import check_db_rate_limit, record_db_attempt, reset_db_attempts
from src.modules.auth.models import User
from src.modules.auth.schemas import (
    AuthTokensResponse,
    CurrentUserResponse,
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    OAuthCallbackRequest,
    RefreshTokenRequest,
    RegisterRequest,
    RegisterResponse,
    ResetPasswordRequest,
    ResendVerificationRequest,
    VerifyEmailRequest,
)
from src.modules.auth.service import AuthService
from src.modules.auth.oauth_state import generate_state, validate_state  # Audit fix 2.3
from src.shared.errors import UnauthorizedError, ValidationError
from src.shared.ip_utils import get_client_ip

logger = logging.getLogger(__name__)

router = APIRouter()


# Audit fix 2.5 — set httpOnly cookies for web clients
def _is_web_client(request: Request) -> bool:
    """Detect browser/web clients via platform header or Sec-Fetch-Mode."""
    return (
        request.headers.get("X-Platform", "").lower() == "web"
        or request.headers.get("Sec-Fetch-Mode") is not None
    )


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Set httpOnly cookies for web clients."""
    response.set_cookie(
        key="access_token", value=access_token,
        httponly=True, secure=True, samesite="lax",
        max_age=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token", value=refresh_token,
        httponly=True, secure=True, samesite="lax",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/v1/auth/refresh",
    )

VERIFY_MAX_ATTEMPTS = 5
VERIFY_WINDOW_SECONDS = 900  # 15 minutes


def _check_verify_rate_limit(user_id: str) -> None:
    """Raise RateLimitedError if user exceeded 5 verify attempts in 15 min."""
    check_user_endpoint_rate_limit(
        user_id, "verify_email", VERIFY_MAX_ATTEMPTS, VERIFY_WINDOW_SECONDS,
    )


def clear_verify_attempts() -> None:
    """Clear all verify rate limit state. Useful for testing."""
    # No-op — Redis keys expire naturally. Tests should flush Redis directly.
    pass


def _get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(db)


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(
    request: Request,
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    service: AuthService = Depends(_get_auth_service),
) -> RegisterResponse:
    """Register a new user with email and password.

    Returns tokens on success, or a generic message if the email is taken
    (to prevent enumeration). An 'account exists' email is sent silently.
    """
    ip = get_client_ip(request)
    check_register_rate_limit(ip)
    # Audit fix 10.11 — CAPTCHA gate
    if settings.REQUIRE_CAPTCHA and not data.captcha_token:
        raise ValidationError("CAPTCHA required")
    await check_db_rate_limit(
        session=db, key=f"register:{ip}", endpoint="register",
        max_attempts=5, window_seconds=3600,
        message="Too many registration attempts. Please try again later.",
    )
    tokens = await service.register_email(email=data.email, password=data.password, ip=ip)
    if tokens is None:
        # Email already exists — return generic message, no tokens
        await record_db_attempt(db, key=f"register:{ip}", endpoint="register")
        return RegisterResponse(
            message="If this email is not already registered, a verification code has been sent.",
        )
    return RegisterResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
        message="If this email is not already registered, a verification code has been sent.",
    )


@router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    service: AuthService = Depends(_get_auth_service),
) -> LoginResponse:
    """Authenticate with email and password."""
    check_lockout(data.email)
    check_rate_limit(data.email)
    check_login_ip_rate_limit(get_client_ip(request))
    await check_db_rate_limit(
        session=db, key=f"login:{data.email}", endpoint="login",
        max_attempts=settings.LOGIN_RATE_LIMIT_THRESHOLD,
        window_seconds=settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
        message="Too many login attempts. Please try again later.",
    )
    try:
        result = await service.login_email(email=data.email, password=data.password, ip=get_client_ip(request))
    except UnauthorizedError:
        record_attempt(data.email)
        await record_db_attempt(db, key=f"login:{data.email}", endpoint="login")
        raise
    # Successful login — clear rate limit counters
    reset_attempts(data.email)
    await reset_db_attempts(db, key=f"login:{data.email}", endpoint="login")
    # Audit fix 2.5 — set httpOnly cookies for web clients
    if _is_web_client(request) and result.access_token and result.refresh_token:
        _set_auth_cookies(response, result.access_token, result.refresh_token)
    return result


# Audit fix 2.3 — OAuth state CSRF protection
@router.get("/oauth/state")
async def get_oauth_state() -> dict:
    """Generate a one-time-use state token for OAuth CSRF protection (web flow)."""
    return {"state": generate_state()}


@router.post("/oauth/{provider}", response_model=AuthTokensResponse)
async def oauth_login(
    data: OAuthCallbackRequest,
    request: Request,
    provider: str = Path(..., pattern=r'^(google|apple)$'),
    service: AuthService = Depends(_get_auth_service),
) -> AuthTokensResponse:
    """Authenticate via OAuth provider (google, apple, etc.)."""
    check_oauth_rate_limit(get_client_ip(request))
    # Audit fix 2.3 — validate state if provided (web flow), allow without for mobile
    if data.state is not None:
        if not validate_state(data.state):
            raise ValidationError("Invalid or expired OAuth state parameter")
    else:
        logger.info("OAuth request without state parameter (mobile flow) from %s", get_client_ip(request))
    tokens = await service.login_oauth(provider=provider, token=data.token, ip=get_client_ip(request), data=data)
    return tokens


@router.post("/refresh", response_model=AuthTokensResponse)
async def refresh(
    request: Request,
    data: RefreshTokenRequest,
    response: Response,
    service: AuthService = Depends(_get_auth_service),
) -> AuthTokensResponse:
    """Obtain a new access token using a valid refresh token."""
    tokens = await service.refresh_token(refresh_token=data.refresh_token)
    # Audit fix 2.5 — set httpOnly cookies for web clients
    if _is_web_client(request):
        _set_auth_cookies(response, tokens.access_token, tokens.refresh_token)
    return tokens


@router.post("/logout", status_code=204, response_model=None)
async def logout(
    request: Request,
    response: Response,
    refresh_token: Optional[str] = Body(None, embed=True),
    user: User = Depends(get_current_user),
    service: AuthService = Depends(_get_auth_service),
) -> None:
    """Logout the current user (invalidate both access and refresh tokens)."""
    from src.middleware.authenticate import _extract_bearer_token
    access_token = _extract_bearer_token(request)
    await service.logout(access_token, refresh_token, ip=get_client_ip(request))
    # Audit fix 2.5 — clear httpOnly cookies on logout
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token", path="/api/v1/auth/refresh")


@router.get("/me", response_model=CurrentUserResponse)
async def get_current_user_info(
    user: User = Depends(get_current_user),
) -> CurrentUserResponse:
    """Return the current authenticated user's basic info."""
    return CurrentUserResponse(id=str(user.id), email=user.email, role=user.role, email_verified=user.email_verified)


@router.post("/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    service: AuthService = Depends(_get_auth_service),
) -> dict:
    """Request a password reset OTP code via email.

    Always returns 200 regardless of whether the email exists,
    to avoid leaking account information.
    """
    check_forgot_password_rate_limit(data.email)
    await service.generate_reset_code(email=data.email)
    return {
        "message": "If an account exists with that email, a reset code has been sent"
    }


@router.post("/reset-password")
async def reset_password(
    request: Request,
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    service: AuthService = Depends(_get_auth_service),
) -> dict:
    """Reset password using a valid 6-digit OTP code."""
    check_reset_password_rate_limit(data.email)
    await check_db_rate_limit(
        session=db, key=f"reset:{data.email}", endpoint="reset_password",
        max_attempts=5, window_seconds=900,
        message="Too many password reset attempts. Please try again later.",
    )
    success = await service.reset_password(
        email=data.email, code=data.code, new_password=data.new_password, ip=get_client_ip(request)
    )
    if not success:
        await record_db_attempt(db, key=f"reset:{data.email}", endpoint="reset_password")
        raise ValidationError("Invalid or expired reset code")
    await reset_db_attempts(db, key=f"reset:{data.email}", endpoint="reset_password")
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


@router.post("/resend-verification-email")
async def resend_verification_by_email(
    data: ResendVerificationRequest,
    service: AuthService = Depends(_get_auth_service),
) -> dict:
    """Resend verification code by email (unauthenticated). For unverified users locked out of login.

    Always returns 200 to prevent email enumeration.
    """
    # Audit fix 2.1 — rate limit email resend
    check_forgot_password_rate_limit(data.email)
    await service.resend_verification_code_by_email(data.email)
    return {"message": "If an unverified account exists, a verification code has been sent"}
