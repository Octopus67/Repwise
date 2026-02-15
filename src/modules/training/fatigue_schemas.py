"""Pydantic schemas for fatigue detection API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class FatigueScoreResponse(BaseModel):
    muscle_group: str
    score: float = Field(ge=0, le=100)
    regression_component: float = Field(ge=0)
    volume_component: float = Field(ge=0)
    frequency_component: float = Field(ge=0)
    nutrition_component: float = Field(ge=0)


class DeloadSuggestionResponse(BaseModel):
    muscle_group: str
    fatigue_score: float = Field(ge=0, le=100)
    top_regressed_exercise: str
    decline_pct: float = Field(ge=0)
    decline_sessions: int = Field(ge=2)
    message: str


class FatigueAnalysisResponse(BaseModel):
    scores: list[FatigueScoreResponse]
    suggestions: list[DeloadSuggestionResponse]
    lookback_days: int = Field(ge=7, le=90)
    analyzed_at: datetime
