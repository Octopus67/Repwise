"""Community module routes — returns admin-configurable community links.

Requirement 13.5: Display Telegram and email links, configurable by admin.
Requirement 13.6: Accessible to both free and premium users.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authorize import require_role
from src.modules.auth.models import User
from src.modules.founder.models import FounderContent
from src.modules.founder.service import FounderService
from src.modules.founder.schemas import FounderContentUpdate
from src.shared.types import UserRole

router = APIRouter()

# Default community links — used when no admin-configured values exist
_DEFAULT_LINKS = {
    "telegram": "https://t.me/hypertrophyos",
    "email": "community@hypertrophyos.com",
}

COMMUNITY_SECTION_KEY = "community_links"


class CommunityLinksResponse(BaseModel):
    """Response schema for community links."""

    telegram: str
    email: str


class CommunityLinksUpdate(BaseModel):
    """Request schema for updating community links (admin only)."""

    telegram: str
    email: str


def _get_service(db: AsyncSession = Depends(get_db)) -> FounderService:
    return FounderService(db)


@router.get("/", response_model=CommunityLinksResponse)
async def get_community_links(
    service: FounderService = Depends(_get_service),
) -> CommunityLinksResponse:
    """Return community links (public).

    Requirement 13.5, 13.6: Accessible to all users.
    Links are stored in founder_content with section_key='community_links'.
    """
    items = await service.get_content(
        section_key=COMMUNITY_SECTION_KEY, locale="en"
    )
    if items:
        content = items[0].content
        return CommunityLinksResponse(
            telegram=content.get("telegram", _DEFAULT_LINKS["telegram"]),
            email=content.get("email", _DEFAULT_LINKS["email"]),
        )
    return CommunityLinksResponse(**_DEFAULT_LINKS)


@router.put("/", response_model=CommunityLinksResponse)
async def update_community_links(
    data: CommunityLinksUpdate,
    admin: User = Depends(require_role(UserRole.ADMIN)),
    service: FounderService = Depends(_get_service),
) -> CommunityLinksResponse:
    """Update community links (admin only).

    Requirement 13.5: Configurable by admin without code changes.
    """
    update = FounderContentUpdate(
        section_key=COMMUNITY_SECTION_KEY,
        locale="en",
        content={"telegram": data.telegram, "email": data.email},
    )
    await service.update_content(data=update, admin_user_id=admin.id)
    return CommunityLinksResponse(telegram=data.telegram, email=data.email)
