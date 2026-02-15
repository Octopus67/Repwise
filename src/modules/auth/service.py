"""Auth service — registration, login, OAuth, JWT management."""

from __future__ import annotations
from typing import Optional

import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.settings import settings
from src.modules.auth.models import User
from src.shared.errors import ConflictError, UnauthorizedError
from src.shared.types import AuthProvider, UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# TODO: Replace with Redis/DB storage for production
_reset_tokens: dict[str, tuple[str, float]] = {}  # token → (email, expiry_timestamp)


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

    async def register_email(self, email: str, password: str) -> AuthTokens:
        """Register a new user with email/password.

        Raises ConflictError if the email is already taken.
        """
        existing = await self._get_user_by_email(email)
        if existing is not None:
            raise ConflictError("A user with this email already exists")

        hashed = _hash_password(password)
        user = User(
            email=email,
            hashed_password=hashed,
            auth_provider=AuthProvider.EMAIL,
            role=UserRole.USER,
        )
        self.session.add(user)
        await self.session.flush()

        return _generate_tokens(user.id)

    async def login_email(self, email: str, password: str) -> AuthTokens:
        """Authenticate with email/password.

        Raises UnauthorizedError on invalid credentials.
        """
        user = await self._get_user_by_email(email)
        if user is None or not _verify_password(password, user.hashed_password):
            raise UnauthorizedError("Invalid email or password")

        return _generate_tokens(user.id)

    async def login_oauth(self, provider: str, token: str) -> AuthTokens:
        """Authenticate or register via OAuth provider.

        Creates a new user if no account is linked to the provider id.
        For MVP the *token* value is treated as the provider user id
        (real verification would call the provider's API).
        """
        provider_user_id = token  # placeholder — real impl verifies with provider

        stmt = select(User).where(
            User.auth_provider == provider,
            User.auth_provider_id == provider_user_id,
            User.deleted_at.is_(None),
        )
        result = await self.session.execute(stmt)
        user = result.scalar_one_or_none()

        if user is None:
            # Create a new user linked to this OAuth provider.
            # Email is derived from the token payload in a real implementation;
            # here we use a placeholder.
            user = User(
                email=f"{provider_user_id}@{provider}.oauth",
                auth_provider=provider,
                auth_provider_id=provider_user_id,
                role=UserRole.USER,
            )
            self.session.add(user)
            await self.session.flush()

        return _generate_tokens(user.id)

    async def refresh_token(self, refresh_token: str) -> AuthTokens:
        """Issue a new token pair from a valid refresh token.

        Raises UnauthorizedError if the token is invalid or expired.
        """
        payload = _decode_token(refresh_token)
        token_type = payload.get("type")
        if token_type != "refresh":
            raise UnauthorizedError("Invalid token type")

        user_id = uuid.UUID(payload["sub"])

        # Verify user still exists and is not deleted
        stmt = select(User).where(User.id == user_id, User.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        user = result.scalar_one_or_none()
        if user is None:
            raise UnauthorizedError("User not found")

        return _generate_tokens(user.id)

    async def logout(self, user_id: uuid.UUID) -> None:  # noqa: ARG002
        """Placeholder for token blacklisting.

        In a production system this would add the current token jti to a
        blacklist (e.g. Redis set with TTL matching token expiry).
        """

    # ------------------------------------------------------------------
    # Password reset
    # ------------------------------------------------------------------

    async def generate_reset_token(self, email: str) -> Optional[str]:
        """Generate a password reset token for the given email.

        Returns None if no user exists with that email (caller should
        still return a generic success message to avoid leaking info).
        """
        user = await self._get_user_by_email(email)
        if user is None:
            return None

        token = str(uuid.uuid4())
        _reset_tokens[token] = (email, time.time() + 3600)
        return token

    async def reset_password(self, token: str, new_password: str) -> bool:
        """Reset a user's password using a valid reset token.

        Returns False if the token is invalid or expired.
        """
        entry = _reset_tokens.get(token)
        if entry is None:
            return False

        email, expiry = entry
        if time.time() > expiry:
            del _reset_tokens[token]
            return False

        user = await self._get_user_by_email(email)
        if user is None:
            del _reset_tokens[token]
            return False

        user.hashed_password = _hash_password(new_password)
        await self.session.commit()
        del _reset_tokens[token]
        return True

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
    return pwd_context.hash(password)


def _verify_password(plain: str, hashed: Optional[str]) -> bool:
    if hashed is None:
        return False
    return pwd_context.verify(plain, hashed)


def _generate_tokens(user_id: uuid.UUID) -> AuthTokens:
    """Create an access + refresh JWT pair."""
    now = datetime.now(timezone.utc)
    access_exp = now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_exp = now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)

    access_payload = {
        "sub": str(user_id),
        "type": "access",
        "exp": access_exp,
        "iat": now,
    }
    refresh_payload = {
        "sub": str(user_id),
        "type": "refresh",
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
