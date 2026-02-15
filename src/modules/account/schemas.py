"""Pydantic schemas for account management."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AccountDeletionResponse(BaseModel):
    """Response after requesting account deletion."""

    message: str
    deleted_at: datetime
    permanent_deletion_date: datetime
    grace_period_days: int = 30


class AccountReactivationResponse(BaseModel):
    """Response after reactivating an account."""

    message: str
    reactivated_at: datetime
