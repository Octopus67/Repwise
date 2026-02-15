"""Pydantic schemas for the content module."""

from __future__ import annotations
from typing import Optional

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ContentModuleResponse(BaseModel):
    """Response schema for a content module (category)."""

    id: uuid.UUID
    name: str
    slug: str
    description: Optional[str] = None
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ArticleCreate(BaseModel):
    """Schema for creating a new article (admin only)."""

    module_id: uuid.UUID
    title: str = Field(..., min_length=1, max_length=500)
    content_markdown: str = Field(default="")
    is_premium: bool = False
    tags: Optional[list[str]] = None
    estimated_read_time_min: Optional[int] = Field(default=None, ge=1)
    youtube_links: Optional[list[str]] = None


class ArticleUpdate(BaseModel):
    """Schema for updating an article (admin only). All fields optional."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    content_markdown: Optional[str] = None
    is_premium: Optional[bool] = None
    tags: Optional[list[str]] = None
    estimated_read_time_min: Optional[int] = Field(default=None, ge=1)
    youtube_links: Optional[list[str]] = None
    module_id: Optional[uuid.UUID] = None


class ArticleResponse(BaseModel):
    """Response schema for an article."""

    id: uuid.UUID
    module_id: uuid.UUID
    title: str
    content_markdown: str
    status: str
    is_premium: bool
    version: int
    tags: Optional[list[str]] = None
    estimated_read_time_min: Optional[int] = None
    youtube_links: Optional[list[str]] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ArticleVersionResponse(BaseModel):
    """Response schema for an article version snapshot."""

    id: uuid.UUID
    article_id: uuid.UUID
    version_number: int
    title: str
    content_markdown: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ArticleFavoriteResponse(BaseModel):
    """Response schema for a favorited article."""

    id: uuid.UUID
    user_id: uuid.UUID
    article_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}
