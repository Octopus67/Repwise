"""Periodization routes — CRUD for training blocks, templates, and deload suggestions."""

from __future__ import annotations
from typing import List, Optional

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.periodization.schemas import (
    ApplyTemplateRequest,
    BlockTemplateResponse,
    DeloadSuggestion,
    TrainingBlockCreate,
    TrainingBlockResponse,
    TrainingBlockUpdate,
)
from src.modules.periodization.service import PeriodizationService
from src.modules.periodization.templates import get_templates

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> PeriodizationService:
    return PeriodizationService(db)


# ─── Block CRUD ───────────────────────────────────────────────────────────────


@router.post("/blocks", response_model=TrainingBlockResponse, status_code=201)
async def create_block(
    data: TrainingBlockCreate,
    user: User = Depends(get_current_user),
    service: PeriodizationService = Depends(_get_service),
) -> TrainingBlockResponse:
    """Create a new training block."""
    return await service.create_block(user_id=user.id, data=data)


@router.get("/blocks", response_model=List[TrainingBlockResponse])
async def list_blocks(
    user: User = Depends(get_current_user),
    service: PeriodizationService = Depends(_get_service),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
) -> list[TrainingBlockResponse]:
    """List training blocks with optional date range filter."""
    return await service.list_blocks(
        user_id=user.id, start_date=start_date, end_date=end_date
    )


# NOTE: /blocks/deload-suggestions MUST be defined BEFORE /blocks/{block_id}
# to avoid FastAPI treating "deload-suggestions" as a block_id parameter.


@router.get("/blocks/deload-suggestions", response_model=List[DeloadSuggestion])
async def get_deload_suggestions(
    user: User = Depends(get_current_user),
    service: PeriodizationService = Depends(_get_service),
) -> list[DeloadSuggestion]:
    """Get deload week suggestions based on consecutive non-deload blocks."""
    return await service.check_deload_suggestions(user_id=user.id)


@router.get("/blocks/{block_id}", response_model=TrainingBlockResponse)
async def get_block(
    block_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: PeriodizationService = Depends(_get_service),
) -> TrainingBlockResponse:
    """Get a single training block by ID."""
    return await service.get_block(user_id=user.id, block_id=block_id)


@router.put("/blocks/{block_id}", response_model=TrainingBlockResponse)
async def update_block(
    block_id: uuid.UUID,
    data: TrainingBlockUpdate,
    user: User = Depends(get_current_user),
    service: PeriodizationService = Depends(_get_service),
) -> TrainingBlockResponse:
    """Update a training block."""
    return await service.update_block(user_id=user.id, block_id=block_id, data=data)


@router.delete("/blocks/{block_id}", status_code=204, response_model=None)
async def delete_block(
    block_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: PeriodizationService = Depends(_get_service),
) -> None:
    """Soft-delete a training block."""
    await service.soft_delete_block(user_id=user.id, block_id=block_id)


# ─── Templates ────────────────────────────────────────────────────────────────


@router.get("/templates", response_model=List[BlockTemplateResponse])
async def list_templates() -> list[dict]:
    """Return all available block templates."""
    return get_templates()


@router.post("/templates/apply", response_model=List[TrainingBlockResponse], status_code=201)
async def apply_template(
    data: ApplyTemplateRequest,
    user: User = Depends(get_current_user),
    service: PeriodizationService = Depends(_get_service),
) -> list[TrainingBlockResponse]:
    """Apply a block template starting from the given date."""
    return await service.apply_template(
        user_id=user.id,
        template_id=data.template_id,
        start_date=data.start_date,
    )
