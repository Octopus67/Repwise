"""Dashboard schemas."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class DashboardSummaryResponse(BaseModel):
    """Consolidated dashboard data."""

    date: str
    nutrition: dict[str, Any]
    adaptive_targets: Optional[Any]
    training: dict[str, Any]
    bodyweight_history: list[Any]
