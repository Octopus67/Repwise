"""SQLAlchemy models for the content/educational module."""

from __future__ import annotations
from typing import Optional

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.shared.audit import AuditLogMixin
from src.shared.base_model import Base
from src.shared.soft_delete import SoftDeleteMixin


class ContentModule(Base):
    """A category/module that groups related articles.

    Modules can be added without schema changes (Requirement 11.6).
    """

    __tablename__ = "content_modules"

    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    articles: Mapped[list[ContentArticle]] = relationship(
        "ContentArticle", back_populates="module", lazy="selectin"
    )


class ContentArticle(Base, SoftDeleteMixin, AuditLogMixin):
    """An educational article with versioning and premium gating.

    Tags are stored as JSONB with a GIN index for tag-based search.
    Supports draft/published states and version history (Requirement 11.7).
    """

    __tablename__ = "content_articles"

    module_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("content_modules.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    is_premium: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    tags: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, server_default=text("'[]'::jsonb")
    )
    estimated_read_time_min: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    youtube_links: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, server_default=text("'[]'::jsonb")
    )
    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    module: Mapped[ContentModule] = relationship(
        "ContentModule", back_populates="articles", lazy="selectin"
    )
    versions: Mapped[list[ArticleVersion]] = relationship(
        "ArticleVersion", back_populates="article", lazy="selectin"
    )

    __table_args__ = (
        Index("ix_content_articles_module_status", "module_id", "status"),
        Index(
            "ix_content_articles_tags",
            "tags",
            postgresql_using="gin",
        ),
        Index(
            "ix_content_articles_not_deleted",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class ArticleVersion(Base):
    """Immutable snapshot of an article at a specific version.

    Created automatically when an article is updated (Requirement 11.7, 15.3).
    """

    __tablename__ = "article_versions"

    article_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("content_articles.id"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False, default="")

    article: Mapped[ContentArticle] = relationship(
        "ContentArticle", back_populates="versions"
    )

    __table_args__ = (
        Index("ix_article_versions_article_version", "article_id", "version_number"),
    )


class ArticleFavorite(Base):
    """Association between a user and a favorited article (Requirement 11.8)."""

    __tablename__ = "article_favorites"

    user_id: Mapped[uuid.UUID] = mapped_column(nullable=False, index=True)
    article_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("content_articles.id"), nullable=False, index=True
    )

    __table_args__ = (
        UniqueConstraint("user_id", "article_id", name="uq_article_favorites_user_article"),
    )
