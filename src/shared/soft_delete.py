"""Soft delete mixin for SQLAlchemy models.

Provides a deleted_at column and a helper to build queries that
exclude soft-deleted records.
"""

from datetime import datetime

from sqlalchemy import Select
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional


class SoftDeleteMixin:
    """Mixin that adds soft-delete support to a SQLAlchemy model.

    Adds a nullable ``deleted_at`` column.  When the column is populated the
    record is considered deleted but remains in the database for recovery.
    """

    deleted_at: Mapped[Optional[datetime]] = mapped_column(default=None, nullable=True)

    @property
    def is_deleted(self) -> bool:
        """Return True if this record has been soft-deleted."""
        return self.deleted_at is not None

    @classmethod
    def not_deleted(cls, statement: Select) -> Select:  # type: ignore[type-arg]
        """Filter a SELECT statement to exclude soft-deleted rows.

        Usage::

            stmt = select(MyModel)
            stmt = MyModel.not_deleted(stmt)
        """
        return statement.where(cls.deleted_at.is_(None))  # type: ignore[attr-defined]
