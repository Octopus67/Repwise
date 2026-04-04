"""JWT authentication dependency for FastAPI."""

import uuid

import jwt
from jwt.exceptions import PyJWTError
from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.config.settings import settings
from src.modules.auth.models import User
from src.shared.errors import UnauthorizedError
from typing import Optional


def _extract_bearer_token(request: Request) -> str:
    """Extract Bearer token from the Authorization header."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise UnauthorizedError("Missing or invalid Authorization header")
    return auth_header[7:]


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency that verifies JWT and returns the authenticated user.

    Extracts the Bearer token from the Authorization header, decodes it
    using python-jose, queries the Users table, and returns the User object.
    Raises UnauthorizedError if the token is invalid/expired or user not found.
    """
    token = _extract_bearer_token(request)

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except PyJWTError:
        raise UnauthorizedError("Invalid or expired token")

    # Check token type
    token_type = payload.get("type")
    if token_type != "access":
        raise UnauthorizedError("Invalid token type")

    # Check if token is blacklisted
    jti = payload.get("jti")
    if jti:
        from src.modules.auth.models import TokenBlacklist
        blacklist_result = await db.execute(
            select(TokenBlacklist).where(TokenBlacklist.jti == jti)
        )
        if blacklist_result.scalar_one_or_none() is not None:
            raise UnauthorizedError("Token has been revoked")

    user_id_str: Optional[str] = payload.get("sub")
    if user_id_str is None:
        raise UnauthorizedError("Invalid token payload")

    try:
        user_id = uuid.UUID(user_id_str)
    except (ValueError, AttributeError):
        raise UnauthorizedError("Invalid token payload")

    result = await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise UnauthorizedError("User not found or deactivated")

    # Invalidate tokens issued before password change
    if user.password_changed_at:
        token_iat = payload.get("iat", 0)
        if token_iat < user.password_changed_at.timestamp():
            raise UnauthorizedError("Password changed. Please login again.")

    return user

async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """FastAPI dependency that returns the authenticated user or None.

    Unlike ``get_current_user``, this does NOT raise if the token is
    missing or invalid — it simply returns ``None``.  Useful for
    endpoints that behave differently for authenticated vs anonymous users.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:]
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except PyJWTError:
        return None

    # Check token type
    if payload.get("type") != "access":
        return None

    # Check if token is blacklisted
    jti = payload.get("jti")
    if jti:
        from src.modules.auth.models import TokenBlacklist
        blacklist_result = await db.execute(
            select(TokenBlacklist).where(TokenBlacklist.jti == jti)
        )
        if blacklist_result.scalar_one_or_none() is not None:
            return None

    user_id_str: Optional[str] = payload.get("sub")
    if user_id_str is None:
        return None

    try:
        user_id = uuid.UUID(user_id_str)
    except (ValueError, AttributeError):
        return None

    result = await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if user is None:
        return None

    # Invalidate tokens issued before password change
    if user.password_changed_at:
        token_iat = payload.get("iat", 0)
        if token_iat < user.password_changed_at.timestamp():
            return None

    return user

