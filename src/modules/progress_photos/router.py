"""Progress photo routes — CRUD with JWT authentication."""

from __future__ import annotations
from typing import Optional

import logging
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.progress_photos.schemas import (
    PhotoCreate,
    PhotoResponse,
    PhotoUpdate,
    UploadUrlRequest,
    UploadUrlResponse,
)
from src.modules.progress_photos.service import ProgressPhotoService
from src.shared.storage import generate_upload_url
from src.shared.pagination import PaginatedResult, PaginationParams

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> ProgressPhotoService:
    return ProgressPhotoService(db)


@router.post("/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    data: UploadUrlRequest,
    user: User = Depends(get_current_user),
) -> UploadUrlResponse:
    """Generate a pre-signed R2 upload URL for a progress photo."""
    result = generate_upload_url(str(user.id), data.filename, data.content_type)
    return UploadUrlResponse(upload_url=result["upload_url"], key=result["key"])


@router.post("", response_model=PhotoResponse, status_code=201)
async def create_photo(
    data: PhotoCreate,
    user: User = Depends(get_current_user),
    service: ProgressPhotoService = Depends(_get_service),
) -> PhotoResponse:
    """Create progress photo metadata for the authenticated user."""
    photo = await service.create_photo(user_id=user.id, data=data)
    return PhotoResponse.model_validate(photo)


@router.get("", response_model=PaginatedResult[PhotoResponse])
async def list_photos(
    user: User = Depends(get_current_user),
    service: ProgressPhotoService = Depends(_get_service),
    pose_type: Optional[str] = Query(
        default=None,
        pattern=r"^(front_relaxed|front_double_bicep|side|back)$",
    ),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> PaginatedResult[PhotoResponse]:
    """List progress photos with optional pose_type filter and pagination."""
    pagination = PaginationParams(page=page, limit=limit)
    result = await service.list_photos(
        user_id=user.id, pagination=pagination, pose_type=pose_type,
    )
    return PaginatedResult[PhotoResponse](
        items=[PhotoResponse.model_validate(p) for p in result.items],
        total_count=result.total_count,
        page=result.page,
        limit=result.limit,
    )


@router.get("/{photo_id}", response_model=PhotoResponse)
async def get_photo(
    photo_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: ProgressPhotoService = Depends(_get_service),
) -> PhotoResponse:
    """Get a single progress photo by ID."""
    photo = await service.get_photo(user_id=user.id, photo_id=photo_id)
    return PhotoResponse.model_validate(photo)


@router.patch("/{photo_id}", response_model=PhotoResponse)
async def update_photo(
    photo_id: uuid.UUID,
    data: PhotoUpdate,
    user: User = Depends(get_current_user),
    service: ProgressPhotoService = Depends(_get_service),
) -> PhotoResponse:
    """Update progress photo metadata (alignment_data)."""
    photo = await service.update_photo(
        user_id=user.id, photo_id=photo_id, data=data,
    )
    return PhotoResponse.model_validate(photo)


@router.delete("/{photo_id}", status_code=204, response_model=None)
async def delete_photo(
    photo_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: ProgressPhotoService = Depends(_get_service),
) -> None:
    """Soft-delete a progress photo."""
    await service.delete_photo(user_id=user.id, photo_id=photo_id)
