"""Weekly challenges router."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.challenges import service

router = APIRouter(prefix="/challenges", tags=["challenges"])


class ChallengeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    challenge_type: str
    title: str
    description: str
    target_value: int
    current_value: int
    week_start: date
    week_end: date
    completed: bool
    completed_at: Optional[datetime] = None


class ProgressUpdate(BaseModel):
    value: int = Field(ge=0, le=10000)


@router.get("/current", response_model=list[ChallengeResponse])
async def get_current_challenges(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChallengeResponse]:
    """Return current week's challenges, auto-generating if none exist."""
    challenges = await service.get_current_challenges(db, current_user.id)
    if not challenges:
        challenges = await service.generate_weekly_challenges(db, current_user.id)
    return [ChallengeResponse.model_validate(c) for c in challenges]


@router.post("/{challenge_id}/progress", response_model=ChallengeResponse)
async def update_progress(
    challenge_id: uuid.UUID,
    body: ProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChallengeResponse:
    """Update progress on a challenge."""
    challenge = await service.update_progress(db, current_user.id, challenge_id, body.value)
    return ChallengeResponse.model_validate(challenge)
