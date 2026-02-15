"""Onboarding routes — single endpoint to complete user setup."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.onboarding.schemas import OnboardingCompleteRequest, OnboardingCompleteResponse
from src.modules.onboarding.service import OnboardingService

router = APIRouter()


def _get_onboarding_service(db: AsyncSession = Depends(get_db)) -> OnboardingService:
    return OnboardingService(db)


@router.post("/complete", response_model=OnboardingCompleteResponse, status_code=201)
async def complete_onboarding(
    data: OnboardingCompleteRequest,
    user: User = Depends(get_current_user),
    service: OnboardingService = Depends(_get_onboarding_service),
) -> OnboardingCompleteResponse:
    """Complete the onboarding flow in a single atomic transaction."""
    return await service.complete_onboarding(user_id=user.id, data=data)
