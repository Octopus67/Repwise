"""Business logic for the content/educational module."""

from __future__ import annotations
from typing import Optional

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.content.models import (
    ArticleFavorite,
    ArticleVersion,
    ContentArticle,
    ContentModule,
)
from src.modules.content.schemas import ArticleCreate, ArticleUpdate
from src.shared.errors import ConflictError, NotFoundError, PremiumRequiredError
from src.shared.pagination import PaginatedResult, PaginationParams
from src.shared.types import AuditAction, ContentStatus


class ContentService:
    """Service layer for content article operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ------------------------------------------------------------------
    # Article listing (paginated, filterable)
    # ------------------------------------------------------------------

    async def get_articles(
        self,
        pagination: Optional[PaginationParams] = None,
        module_id: Optional[uuid.UUID] = None,
        category: Optional[str] = None,
        tag: Optional[str] = None,
        status: Optional[str] = None,
    ) -> PaginatedResult[ContentArticle]:
        """Return paginated articles, filterable by category and tags.

        Requirement 11.1: paginated list filterable by category and tags.
        """
        pagination = pagination or PaginationParams()

        base = select(ContentArticle)
        base = ContentArticle.not_deleted(base)

        if module_id is not None:
            base = base.where(ContentArticle.module_id == module_id)
        if category is not None:
            base = base.join(ContentModule, ContentArticle.module_id == ContentModule.id).where(
                func.lower(ContentModule.name) == func.lower(category)
            )
        if status is not None:
            base = base.where(ContentArticle.status == status)
        if tag is not None:
            # JSONB array containment — works with GIN index
            # For SQLite tests we fall back to a simpler check
            base = base.where(ContentArticle.tags.op("@>")(f'["{tag}"]'))

        count_stmt = select(func.count()).select_from(base.subquery())
        total_count = (await self.session.execute(count_stmt)).scalar_one()

        items_stmt = (
            base.order_by(ContentArticle.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        result = await self.session.execute(items_stmt)
        items = list(result.scalars().all())

        return PaginatedResult[ContentArticle](
            items=items,
            total_count=total_count,
            page=pagination.page,
            limit=pagination.limit,
        )

    # ------------------------------------------------------------------
    # Single article retrieval with premium gating
    # ------------------------------------------------------------------

    async def get_article(
        self,
        article_id: uuid.UUID,
        user_role: Optional[str] = None,
        has_premium: bool = False,
    ) -> ContentArticle:
        """Return a single article by ID.

        Requirement 11.2: full article content.
        Requirement 11.4/11.5: premium content gating.
        """
        article = await self._get_article_or_raise(article_id)

        if article.is_premium and not has_premium and user_role != "admin":
            raise PremiumRequiredError(
                "This article requires an active premium subscription"
            )

        return article

    # ------------------------------------------------------------------
    # Admin: create article
    # ------------------------------------------------------------------

    async def create_article(
        self,
        data: ArticleCreate,
    ) -> ContentArticle:
        """Create a new article in draft status.

        Requirement 11.6: articles under content modules.
        Requirement 21.1: admin creates content.
        """
        # Verify module exists
        module = await self.session.get(ContentModule, data.module_id)
        if module is None:
            raise NotFoundError("Content module not found")

        article = ContentArticle(
            module_id=data.module_id,
            title=data.title,
            content_markdown=data.content_markdown,
            status=ContentStatus.DRAFT,
            is_premium=data.is_premium,
            version=1,
            tags=data.tags,
            estimated_read_time_min=data.estimated_read_time_min,
            youtube_links=data.youtube_links,
        )
        self.session.add(article)
        await self.session.flush()
        return article

    # ------------------------------------------------------------------
    # Admin: update article with versioning
    # ------------------------------------------------------------------

    async def update_article(
        self,
        article_id: uuid.UUID,
        data: ArticleUpdate,
        admin_user_id: Optional[uuid.UUID] = None,
    ) -> ContentArticle:
        """Update an article and preserve the previous version.

        Requirement 11.7: version history on update.
        Requirement 21.1: admin updates content with version history.
        """
        article = await self._get_article_or_raise(article_id)

        # Snapshot current version before applying changes
        version_snapshot = ArticleVersion(
            article_id=article.id,
            version_number=article.version,
            title=article.title,
            content_markdown=article.content_markdown,
        )
        self.session.add(version_snapshot)

        # Apply updates
        update_data = data.model_dump(exclude_unset=True)
        old_values: dict = {}
        new_values: dict = {}

        for field, value in update_data.items():
            old_val = getattr(article, field)
            if old_val != value:
                old_values[field] = old_val
                new_values[field] = value
                setattr(article, field, value)

        # Increment version
        article.version += 1

        # Audit trail
        if admin_user_id and old_values:
            await ContentArticle.write_audit(
                self.session,
                user_id=admin_user_id,
                action=AuditAction.UPDATE,
                entity_id=article_id,
                changes={"old": old_values, "new": new_values},
            )

        await self.session.flush()
        return article

    # ------------------------------------------------------------------
    # Admin: publish article
    # ------------------------------------------------------------------

    async def publish_article(
        self,
        article_id: uuid.UUID,
        admin_user_id: Optional[uuid.UUID] = None,
    ) -> ContentArticle:
        """Transition an article from draft to published.

        Requirement 11.7: draft and published states.
        """
        article = await self._get_article_or_raise(article_id)
        article.status = ContentStatus.PUBLISHED
        article.published_at = datetime.now(timezone.utc)

        if admin_user_id:
            await ContentArticle.write_audit(
                self.session,
                user_id=admin_user_id,
                action=AuditAction.UPDATE,
                entity_id=article_id,
                changes={"status": "published"},
            )

        await self.session.flush()
        return article

    # ------------------------------------------------------------------
    # Favorites
    # ------------------------------------------------------------------

    async def save_to_favorites(
        self,
        user_id: uuid.UUID,
        article_id: uuid.UUID,
    ) -> ArticleFavorite:
        """Save an article to the user's favorites (Requirement 11.8)."""
        # Verify article exists
        await self._get_article_or_raise(article_id)

        # Check for duplicate
        stmt = select(ArticleFavorite).where(
            ArticleFavorite.user_id == user_id,
            ArticleFavorite.article_id == article_id,
        )
        existing = (await self.session.execute(stmt)).scalar_one_or_none()
        if existing is not None:
            raise ConflictError("Article already in favorites")

        fav = ArticleFavorite(user_id=user_id, article_id=article_id)
        self.session.add(fav)
        await self.session.flush()
        return fav

    async def remove_favorite(
        self,
        user_id: uuid.UUID,
        article_id: uuid.UUID,
    ) -> None:
        """Remove an article from the user's favorites."""
        stmt = select(ArticleFavorite).where(
            ArticleFavorite.user_id == user_id,
            ArticleFavorite.article_id == article_id,
        )
        fav = (await self.session.execute(stmt)).scalar_one_or_none()
        if fav is None:
            raise NotFoundError("Article not in favorites")
        await self.session.delete(fav)
        await self.session.flush()

    async def get_favorite_articles(
        self,
        user_id: uuid.UUID,
        pagination: Optional[PaginationParams] = None,
    ) -> PaginatedResult[ContentArticle]:
        """Return the user's favorited articles (Requirement 11.8)."""
        pagination = pagination or PaginationParams()

        fav_subq = (
            select(ArticleFavorite.article_id)
            .where(ArticleFavorite.user_id == user_id)
            .subquery()
        )

        base = select(ContentArticle).where(
            ContentArticle.id.in_(select(fav_subq.c.article_id))
        )
        base = ContentArticle.not_deleted(base)

        count_stmt = select(func.count()).select_from(base.subquery())
        total_count = (await self.session.execute(count_stmt)).scalar_one()

        items_stmt = (
            base.order_by(ContentArticle.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        result = await self.session.execute(items_stmt)
        items = list(result.scalars().all())

        return PaginatedResult[ContentArticle](
            items=items,
            total_count=total_count,
            page=pagination.page,
            limit=pagination.limit,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_article_or_raise(
        self,
        article_id: uuid.UUID,
    ) -> ContentArticle:
        """Fetch a non-deleted article or raise NotFoundError."""
        stmt = select(ContentArticle).where(ContentArticle.id == article_id)
        stmt = ContentArticle.not_deleted(stmt)
        result = await self.session.execute(stmt)
        article = result.scalar_one_or_none()
        if article is None:
            raise NotFoundError("Article not found")
        return article
