"""Pydantic schemas for the achievement system API."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class AchievementDefResponse(BaseModel):
    """Static achievement definition returned by the API."""

    id: str
    category: str
    title: str
    description: str
    icon: str
    threshold: float = Field(ge=0, le=10_000_000)


class AchievementWithStatus(BaseModel):
    """Achievement definition enriched with the user's unlock/progress state."""

    definition: AchievementDefResponse
    unlocked: bool
    unlocked_at: Optional[datetime] = None
    progress: Optional[float] = None  # 0.0–1.0 fraction toward unlock
    current_value: Optional[float] = None  # raw progress value


class UserAchievementResponse(BaseModel):
    """A single unlocked achievement for a user."""

    achievement_id: str
    title: str
    description: str
    icon: str
    category: str
    unlocked_at: datetime
    trigger_data: Optional[dict[str, Any]] = None

    model_config = {"from_attributes": True}


class StreakResponse(BaseModel):
    """Current and longest streak counts."""

    current_streak: int
    longest_streak: int


class NewlyUnlockedResponse(BaseModel):
    """Included in training/nutrition API responses when achievements unlock."""

    achievement_id: str
    title: str
    description: str
    icon: str
    category: str


class StreakFreezeRecord(BaseModel):
    """A single streak freeze record."""

    id: str
    freeze_date: str
    month: str
    used_at: datetime

    model_config = {"from_attributes": True}


class StreakFreezeStatusResponse(BaseModel):
    """Current freeze availability and history."""

    available: int
    used_this_month: int
    history: list[StreakFreezeRecord]


class ManualFreezeRequest(BaseModel):
    """Request body for manually freezing a date."""

    date: str = Field(description="YYYY-MM-DD date to freeze")


class ManualFreezeResponse(BaseModel):
    """Response after manually applying a freeze."""

    success: bool
    freeze: Optional[StreakFreezeRecord] = None
    message: str
