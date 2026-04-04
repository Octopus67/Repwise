"""Account management routes — deletion, reactivation, cleanup."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.middleware.rate_limiter import check_user_endpoint_rate_limit
from src.modules.account.schemas import AccountDeletionResponse, AccountReactivationResponse
from src.modules.account.service import AccountService
from src.modules.auth.models import User

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> AccountService:
    return AccountService(db)


@router.delete("/", response_model=AccountDeletionResponse)
async def delete_account(
    user: User = Depends(get_current_user),
    service: AccountService = Depends(_get_service),
) -> AccountDeletionResponse:
    """Request account deletion with 30-day grace period.

    Requirement 22.1, 22.4, 22.5.
    """
    check_user_endpoint_rate_limit(str(user.id), "account:delete", 3, 60)
    result = await service.request_deletion(user.id)
    return AccountDeletionResponse(**result)


@router.post("/reactivate", response_model=AccountReactivationResponse)
async def reactivate_account(
    current_user: User = Depends(get_current_user),
    service: AccountService = Depends(_get_service),
) -> AccountReactivationResponse:
    """Reactivate a deactivated account within the grace period.

    Uses the authenticated user's ID for reactivation.

    Requirement 22.3.
    """
    result = await service.reactivate(current_user.id)
    return AccountReactivationResponse(**result)
