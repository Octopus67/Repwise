"""Role-based access control dependency for FastAPI."""

from collections.abc import Callable

from fastapi import Depends

from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.shared.errors import ForbiddenError
from src.shared.types import UserRole


def require_role(*roles: UserRole) -> Callable:
    """Return a FastAPI dependency that checks the user has one of the allowed roles.

    Usage:
        @router.post("/admin-only")
        async def admin_endpoint(user: User = Depends(require_role(UserRole.ADMIN))):
            ...
    """

    async def _check_role(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise ForbiddenError(
                f"Role '{user.role}' is not allowed. Required: {', '.join(roles)}"
            )
        return user

    return _check_role
