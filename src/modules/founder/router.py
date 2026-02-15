"""Founder story routes — public read, admin write."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authorize import require_role
from src.modules.auth.models import User
from src.modules.founder.schemas import FounderContentResponse, FounderContentUpdate
from src.modules.founder.service import FounderService
from src.shared.types import UserRole
from typing import List, Optional

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> FounderService:
    return FounderService(db)


@router.get("/", response_model=List[FounderContentResponse])
async def get_founder_content(
    service: FounderService = Depends(_get_service),
    section_key: Optional[str] = Query(default=None),
    locale: str = Query(default="en"),
) -> list[FounderContentResponse]:
    """Return founder story content (public).

    Requirement 13.1, 13.6: Accessible to all users.
    """
    items = await service.get_content(section_key=section_key, locale=locale)
    return [FounderContentResponse.model_validate(i) for i in items]


@router.put("/", response_model=FounderContentResponse)
async def update_founder_content(
    data: FounderContentUpdate,
    admin: User = Depends(require_role(UserRole.ADMIN)),
    service: FounderService = Depends(_get_service),
) -> FounderContentResponse:
    """Create or update founder content (admin only).

    Requirement 13.2, 21.3: Admin updates immediately available.
    """
    entry = await service.update_content(data=data, admin_user_id=admin.id)
    return FounderContentResponse.model_validate(entry)
