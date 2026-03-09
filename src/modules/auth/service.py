"""Auth service — registration, login, OAuth, JWT management."""

from __future__ import annotations
from typing import Optional

import hashlib
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import bcrypt
import httpx
import jwt as pyjwt
from jwt import PyJWKClient
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from jose import JWTError, jwt
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.settings import settings
from src.modules.auth.models import User, PasswordResetCode, TokenBlacklist, EmailVerificationCode
from src.shared.errors import ApiError, ConflictError, UnauthorizedError, RateLimitedError
from src.shared.types import AuthProvider, UserRole

APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
APPLE_ISSUER = "https://appleid.apple.com"

_apple_jwk_client = PyJWKClient(APPLE_JWKS_URL, cache_keys=True)


@dataclass
class AuthTokens:
    """Internal token pair representation."""

    access_token: str
    refresh_token: str
    expires_in: int


class AuthService:
    """Handles registration, login, OAuth, and token lifecycle."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def register_email(self, email: str, password: str) -> AuthTokens | None:
        """Register a new user with email/password.

        Returns None if the email is already taken (caller should return
        a generic success message to prevent enumeration, while we send
        an "account already exists" notification to the real owner).
        """
        existing = await self._get_user_by_email(email)
        if existing is not None:
            from src.services.email_service import EmailService
            EmailService().send_account_exists_notification(email)
            return None

        hashed = _hash_password(password)
        user = User(
            email=email,
            hashed_password=hashed,
            auth_provider=AuthProvider.EMAIL,
            role=UserRole.USER,
        )
        self.session.add(user)
        await self.session.flush()

        # Send email verification code
        await self.create_and_send_verification_code(user)

        return _generate_tokens(user.id)

    async def login_email(self, email: str, password: str) -> AuthTokens:
        """Authenticate with email/password.

        Raises UnauthorizedError on invalid credentials.
        Raises UnauthorizedError with EMAIL_NOT_VERIFIED code if email is unverified.
        """
        user = await self._get_user_by_email(email)
        if user is None or not _verify_password(password, user.hashed_password):
            raise UnauthorizedError("Invalid email or password")

        if not user.email_verified:
            raise ApiError(
                status=403,
                code="EMAIL_NOT_VERIFIED",
                message="Please verify your email before logging in",
            )

        return _generate_tokens(user.id)

    async def login_oauth(self, provider: str, token: str) -> AuthTokens:
        """Authenticate or register via OAuth provider.

        Creates a new user if no account is linked to the provider id.
        For Google: verifies the ID token with Google's servers.
        For Apple: placeholder implementation (TODO).
        """
        if provider == "google":
            if not settings.GOOGLE_CLIENT_ID:
                raise UnauthorizedError("Google OAuth not configured")
            
            try:
                # Verify Google ID token
                idinfo = id_token.verify_oauth2_token(
                    token, google_requests.Request(), settings.GOOGLE_CLIENT_ID
                )
                provider_user_id = idinfo["sub"]
                email = idinfo["email"]
            except ValueError:
                raise UnauthorizedError("Invalid Google token")
        elif provider == "apple":
            if not settings.APPLE_CLIENT_ID:
                raise UnauthorizedError("Apple OAuth not configured")
            try:
                signing_key = _apple_jwk_client.get_signing_key_from_jwt(token)
                decoded = pyjwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256"],
                    audience=settings.APPLE_CLIENT_ID,
                    issuer=APPLE_ISSUER,
                )
                provider_user_id = decoded["sub"]
                email = decoded.get("email", f"{decoded['sub']}@privaterelay.appleid.com")
            except (pyjwt.InvalidTokenError, KeyError):
                raise UnauthorizedError("Invalid Apple token")
        else:
            raise UnauthorizedError("Unsupported OAuth provider")

        stmt = select(User).where(
            User.auth_provider == provider,
            User.auth_provider_id == provider_user_id,
            User.deleted_at.is_(None),
        )
        result = await self.session.execute(stmt)
        user = result.scalar_one_or_none()

        if user is None:
            # Check if an active user already exists with this email
            existing = await self._get_user_by_email(email)
            if existing is not None:
                if existing.auth_provider == AuthProvider.EMAIL:
                    # Don't overwrite email auth — instead mark as OAuth-linked
                    # Keep auth_provider as EMAIL so password login still works
                    # Store OAuth link in metadata for future multi-provider support
                    existing.email_verified = True
                    if not existing.metadata_:
                        existing.metadata_ = {}
                    if "linked_providers" not in existing.metadata_:
                        existing.metadata_["linked_providers"] = []
                    existing.metadata_["linked_providers"].append({
                        "provider": provider,
                        "provider_id": provider_user_id
                    })
                    # Force SQLAlchemy to detect JSONB mutation
                    from sqlalchemy.orm.attributes import flag_modified
                    flag_modified(existing, "metadata_")
                    await self.session.flush()
                    return _generate_tokens(existing.id)
                else:
                    raise ConflictError(
                        "An account with this email already exists via another provider"
                    )

            # Create a new user linked to this OAuth provider
            user = User(
                email=email,
                auth_provider=provider,
                auth_provider_id=provider_user_id,
                email_verified=True,
                role=UserRole.USER,
            )
            self.session.add(user)
            await self.session.flush()

        return _generate_tokens(user.id)

    async def refresh_token(self, refresh_token: str) -> AuthTokens:
        """Issue a new token pair from a valid refresh token.

        Raises UnauthorizedError if the token is invalid or expired.
        Blacklists the old refresh token to prevent reuse.
        """
        payload = _decode_token(refresh_token)
        token_type = payload.get("type")
        if token_type != "refresh":
            raise UnauthorizedError("Invalid token type")

        # Check if refresh token is blacklisted
        jti = payload.get("jti")
        if jti:
            stmt = select(TokenBlacklist).where(TokenBlacklist.jti == jti)
            result = await self.session.execute(stmt)
            if result.scalar_one_or_none() is not None:
                raise UnauthorizedError("Token has been revoked")

        user_id = uuid.UUID(payload["sub"])

        # Verify user still exists and is not deleted
        stmt = select(User).where(User.id == user_id, User.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        user = result.scalar_one_or_none()
        if user is None:
            raise UnauthorizedError("User not found")

        # Blacklist the old refresh token (rotation security)
        if jti:
            exp = payload.get("exp")
            if exp:
                expires_at = datetime.fromtimestamp(exp, timezone.utc)
                blacklist_entry = TokenBlacklist(jti=jti, expires_at=expires_at)
                self.session.add(blacklist_entry)
                await self.session.flush()

        return _generate_tokens(user.id)

    async def logout(self, access_token: str, refresh_token: Optional[str] = None) -> None:
        """Add tokens to blacklist to invalidate them.

        Blacklists both access and refresh tokens for complete logout.
        """
        # Blacklist access token
        try:
            payload = _decode_token(access_token)
            jti = payload.get("jti")
            if jti:
                exp = payload.get("exp")
                if exp:
                    expires_at = datetime.fromtimestamp(exp, timezone.utc)
                    blacklist_entry = TokenBlacklist(jti=jti, expires_at=expires_at)
                    self.session.add(blacklist_entry)
        except (JWTError, ValueError):
            pass  # Invalid token, nothing to blacklist
        
        # Blacklist refresh token if provided
        if refresh_token:
            try:
                payload = _decode_token(refresh_token)
                jti = payload.get("jti")
                if jti:
                    exp = payload.get("exp")
                    if exp:
                        expires_at = datetime.fromtimestamp(exp, timezone.utc)
                        blacklist_entry = TokenBlacklist(jti=jti, expires_at=expires_at)
                        self.session.add(blacklist_entry)
            except (JWTError, ValueError):
                pass
        
        # Use flush instead of commit (let request lifecycle handle commit)
        await self.session.flush()

    # ------------------------------------------------------------------
    # Password reset
    # ------------------------------------------------------------------

    async def generate_reset_code(self, email: str) -> None:
        """Generate a 6-digit OTP for password reset and send via email.

        Does nothing if no user exists (caller should still return generic message).
        """
        user = await self._get_user_by_email(email)
        if user is None:
            return

        from src.services.email_service import EmailService, generate_otp

        code = generate_otp()
        code_hash = bcrypt.hashpw(code.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

        reset_code = PasswordResetCode(
            user_id=user.id,
            code_hash=code_hash,
            expires_at=expires_at,
        )
        self.session.add(reset_code)
        await self.session.flush()

        EmailService().send_password_reset_code(user.email, code)

    async def reset_password(self, email: str, code: str, new_password: str) -> bool:
        """Reset a user's password using a valid 6-digit OTP.

        Returns False if the code is invalid, expired, or already used.
        """
        user = await self._get_user_by_email(email)
        if user is None:
            return False

        now = datetime.now(timezone.utc)
        stmt = (
            select(PasswordResetCode)
            .where(
                PasswordResetCode.user_id == user.id,
                PasswordResetCode.expires_at > now,
                PasswordResetCode.used == False,
            )
            .order_by(PasswordResetCode.created_at.desc())
        )
        result = await self.session.execute(stmt)
        codes = result.scalars().all()

        for rc in codes:
            if bcrypt.checkpw(code.encode("utf-8"), rc.code_hash.encode("utf-8")):
                rc.used = True
                user.hashed_password = _hash_password(new_password)
                await self.session.flush()
                return True

        return False

    # ------------------------------------------------------------------
    # Email verification
    # ------------------------------------------------------------------

    async def create_and_send_verification_code(self, user: User) -> None:
        """Generate a 6-digit OTP, hash it, store it, and send via SES."""
        from src.services.email_service import EmailService, generate_otp

        code = generate_otp()
        code_hash = bcrypt.hashpw(code.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

        verification = EmailVerificationCode(
            user_id=user.id,
            code_hash=code_hash,
            expires_at=expires_at,
        )
        self.session.add(verification)
        await self.session.flush()

        EmailService().send_verification_code(user.email, code)

    async def verify_email(self, user_id: uuid.UUID, code: str) -> bool:
        """Verify the OTP code and mark the user's email as verified."""
        now = datetime.now(timezone.utc)
        stmt = (
            select(EmailVerificationCode)
            .where(
                EmailVerificationCode.user_id == user_id,
                EmailVerificationCode.expires_at > now,
                EmailVerificationCode.used == False,
            )
            .order_by(EmailVerificationCode.created_at.desc())
        )
        result = await self.session.execute(stmt)
        codes = result.scalars().all()

        for vc in codes:
            if bcrypt.checkpw(code.encode("utf-8"), vc.code_hash.encode("utf-8")):
                vc.used = True
                user = await self.session.get(User, user_id)
                if user:
                    user.email_verified = True
                await self.session.flush()
                return True
        return False

    async def resend_verification_code(self, user: User) -> None:
        """Resend verification code with rate limiting (max 3 per 15 min)."""
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(minutes=15)

        stmt = select(EmailVerificationCode).where(
            EmailVerificationCode.user_id == user.id,
            EmailVerificationCode.created_at > window_start,
        )
        result = await self.session.execute(stmt)
        recent_codes = result.scalars().all()

        if len(recent_codes) >= 3:
            raise RateLimitedError(
                message="Too many verification code requests. Please try again later.",
                retry_after=900,
            )

        await self.create_and_send_verification_code(user)

    async def resend_verification_code_by_email(self, email: str) -> None:
        """Resend verification code by email (unauthenticated). Silent on unknown/verified emails."""
        user = await self._get_user_by_email(email)
        if user is None or user.email_verified:
            return
        await self.resend_verification_code(user)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_user_by_email(self, email: str) -> Optional[User]:
        stmt = select(User).where(User.email == email, User.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()


# ------------------------------------------------------------------
# Module-level helpers (stateless)
# ------------------------------------------------------------------


def _hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def _verify_password(plain: str, hashed: Optional[str]) -> bool:
    """Verify password against bcrypt hash."""
    if hashed is None:
        return False
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def _generate_tokens(user_id: uuid.UUID) -> AuthTokens:
    """Create an access + refresh JWT pair."""
    now = datetime.now(timezone.utc)
    access_exp = now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_exp = now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)

    access_jti = str(uuid.uuid4())
    refresh_jti = str(uuid.uuid4())

    access_payload = {
        "sub": str(user_id),
        "type": "access",
        "jti": access_jti,
        "exp": access_exp,
        "iat": now,
    }
    refresh_payload = {
        "sub": str(user_id),
        "type": "refresh",
        "jti": refresh_jti,
        "exp": refresh_exp,
        "iat": now,
    }

    access_token = jwt.encode(
        access_payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM
    )
    refresh_token = jwt.encode(
        refresh_payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM
    )

    return AuthTokens(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


def _decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises UnauthorizedError on failure."""
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        raise UnauthorizedError("Invalid or expired token")
