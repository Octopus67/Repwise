"""Pagination utilities for list endpoints."""

from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationParams(BaseModel):
    """Query parameters for paginated list endpoints."""

    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    limit: int = Field(default=20, ge=1, le=100, description="Items per page")

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.limit


class PaginatedResult(BaseModel, Generic[T]):
    """Paginated response wrapper."""

    model_config = {"arbitrary_types_allowed": True}

    items: list[T]
    total_count: int
    page: int
    limit: int

    @property
    def total_pages(self) -> int:
        if self.total_count == 0:
            return 0
        return (self.total_count + self.limit - 1) // self.limit

    @property
    def has_next(self) -> bool:
        return self.page < self.total_pages

    @property
    def has_previous(self) -> bool:
        return self.page > 1
