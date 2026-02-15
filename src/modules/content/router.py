"""Content module routes — articles, favorites, admin management."""

from __future__ import annotations
from typing import Optional

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.middleware.authorize import require_role
from src.modules.auth.models import User
from src.modules.content.schemas import (
    ArticleCreate,
    ArticleFavoriteResponse,
    ArticleResponse,
    ArticleUpdate,
)
from src.modules.content.service import ContentService
from src.shared.pagination import PaginatedResult, PaginationParams
from src.shared.types import UserRole

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> ContentService:
    return ContentService(db)


# ------------------------------------------------------------------
# Public / authenticated endpoints
# ------------------------------------------------------------------


@router.get("/articles", response_model=PaginatedResult[ArticleResponse])
async def get_articles(
    user: User = Depends(get_current_user),
    service: ContentService = Depends(_get_service),
    module_id: Optional[uuid.UUID] = Query(default=None),
    category: Optional[str] = Query(default=None),
    tag: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> PaginatedResult[ArticleResponse]:
    """List published articles with optional category/tag filters."""
    pagination = PaginationParams(page=page, limit=limit)
    result = await service.get_articles(
        pagination=pagination,
        module_id=module_id,
        category=category,
        tag=tag,
        status="published",
    )
    return PaginatedResult[ArticleResponse](
        items=[ArticleResponse.model_validate(a) for a in result.items],
        total_count=result.total_count,
        page=result.page,
        limit=result.limit,
    )


@router.get("/articles/{article_id}", response_model=ArticleResponse)
async def get_article(
    article_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: ContentService = Depends(_get_service),
) -> ArticleResponse:
    """Get a single article. Premium articles require an active subscription."""
    has_premium = user.role in (UserRole.PREMIUM, UserRole.ADMIN)
    article = await service.get_article(
        article_id=article_id,
        user_role=user.role,
        has_premium=has_premium,
    )
    return ArticleResponse.model_validate(article)


# ------------------------------------------------------------------
# Admin-only endpoints
# ------------------------------------------------------------------


@router.post("/articles", response_model=ArticleResponse, status_code=201)
async def create_article(
    data: ArticleCreate,
    user: User = Depends(require_role(UserRole.ADMIN)),
    service: ContentService = Depends(_get_service),
) -> ArticleResponse:
    """Create a new article (admin only). Requirement 21.1."""
    article = await service.create_article(data=data)
    return ArticleResponse.model_validate(article)


@router.put("/articles/{article_id}", response_model=ArticleResponse)
async def update_article(
    article_id: uuid.UUID,
    data: ArticleUpdate,
    user: User = Depends(require_role(UserRole.ADMIN)),
    service: ContentService = Depends(_get_service),
) -> ArticleResponse:
    """Update an article with versioning (admin only). Requirement 21.1."""
    article = await service.update_article(
        article_id=article_id,
        data=data,
        admin_user_id=user.id,
    )
    return ArticleResponse.model_validate(article)


@router.post("/articles/{article_id}/publish", response_model=ArticleResponse)
async def publish_article(
    article_id: uuid.UUID,
    user: User = Depends(require_role(UserRole.ADMIN)),
    service: ContentService = Depends(_get_service),
) -> ArticleResponse:
    """Publish a draft article (admin only)."""
    article = await service.publish_article(
        article_id=article_id,
        admin_user_id=user.id,
    )
    return ArticleResponse.model_validate(article)


# ------------------------------------------------------------------
# Favorites
# ------------------------------------------------------------------


@router.post(
    "/articles/{article_id}/favorite",
    response_model=ArticleFavoriteResponse,
    status_code=201,
)
async def save_to_favorites(
    article_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: ContentService = Depends(_get_service),
) -> ArticleFavoriteResponse:
    """Save an article to the user's favorites. Requirement 11.8."""
    fav = await service.save_to_favorites(user_id=user.id, article_id=article_id)
    return ArticleFavoriteResponse.model_validate(fav)


@router.delete("/articles/{article_id}/favorite", status_code=204, response_model=None)
async def remove_favorite(
    article_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: ContentService = Depends(_get_service),
) -> None:
    """Remove an article from the user's favorites."""
    await service.remove_favorite(user_id=user.id, article_id=article_id)


@router.get("/favorites", response_model=PaginatedResult[ArticleResponse])
async def get_favorites(
    user: User = Depends(get_current_user),
    service: ContentService = Depends(_get_service),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> PaginatedResult[ArticleResponse]:
    """Get the user's favorited articles."""
    pagination = PaginationParams(page=page, limit=limit)
    result = await service.get_favorite_articles(
        user_id=user.id, pagination=pagination
    )
    return PaginatedResult[ArticleResponse](
        items=[ArticleResponse.model_validate(a) for a in result.items],
        total_count=result.total_count,
        page=result.page,
        limit=result.limit,
    )
