"""Body measurements router.

POST   /measurements                     — Create measurement
GET    /measurements                     — List measurements (paginated)
GET    /measurements/latest              — Get latest measurement
GET    /measurements/trend               — Get measurement trend
GET    /measurements/{id}                — Get measurement by ID
PUT    /measurements/{id}                — Update measurement
DELETE /measurements/{id}                — Delete measurement
POST   /measurements/{id}/photos         — Upload progress photo
DELETE /photos/{id}                       — Delete progress photo
"""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.measurements.schemas import (
    MeasurementCreate,
    MeasurementResponse,
    MeasurementUpdate,
    NavyBFRequest,
    NavyBFResponse,
    PhotoResponse,
    PhotoUpload,
    TrendPoint,
)
from src.modules.measurements.service import MeasurementService
from src.modules.measurements.photo_service import PhotoService
from src.modules.measurements.navy_calculator import navy_body_fat
from src.shared.pagination import PaginatedResult, PaginationParams

router = APIRouter()


def _get_measurement_service(db: AsyncSession = Depends(get_db)) -> MeasurementService:
    return MeasurementService(db)


def _get_photo_service(db: AsyncSession = Depends(get_db)) -> PhotoService:
    return PhotoService(db)


@router.post("/measurements", response_model=MeasurementResponse, status_code=201)
async def create_measurement(
    data: MeasurementCreate,
    user: User = Depends(get_current_user),
    service: MeasurementService = Depends(_get_measurement_service),
) -> MeasurementResponse:
    measurement = await service.create(user_id=user.id, data=data)
    return MeasurementResponse.model_validate(measurement)


@router.get("/measurements", response_model=PaginatedResult[MeasurementResponse])
async def list_measurements(
    user: User = Depends(get_current_user),
    service: MeasurementService = Depends(_get_measurement_service),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> PaginatedResult[MeasurementResponse]:
    pagination = PaginationParams(page=page, limit=limit)
    return await service.list(user_id=user.id, pagination=pagination)


@router.get("/measurements/latest", response_model=MeasurementResponse)
async def get_latest_measurement(
    user: User = Depends(get_current_user),
    service: MeasurementService = Depends(_get_measurement_service),
) -> MeasurementResponse:
    measurement = await service.get_latest(user_id=user.id)
    return MeasurementResponse.model_validate(measurement)


@router.get("/measurements/trend", response_model=list[TrendPoint])
async def get_measurement_trend(
    user: User = Depends(get_current_user),
    service: MeasurementService = Depends(_get_measurement_service),
    days: int = Query(default=90, ge=7, le=365),
) -> list[TrendPoint]:
    return await service.get_trend(user_id=user.id, days=days)


@router.get("/measurements/{measurement_id}", response_model=MeasurementResponse)
async def get_measurement(
    measurement_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: MeasurementService = Depends(_get_measurement_service),
) -> MeasurementResponse:
    measurement = await service.get(user_id=user.id, measurement_id=measurement_id)
    return MeasurementResponse.model_validate(measurement)


@router.put("/measurements/{measurement_id}", response_model=MeasurementResponse)
async def update_measurement(
    measurement_id: uuid.UUID,
    data: MeasurementUpdate,
    user: User = Depends(get_current_user),
    service: MeasurementService = Depends(_get_measurement_service),
) -> MeasurementResponse:
    measurement = await service.update(user_id=user.id, measurement_id=measurement_id, data=data)
    return MeasurementResponse.model_validate(measurement)


@router.delete("/measurements/{measurement_id}", status_code=204)
async def delete_measurement(
    measurement_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: MeasurementService = Depends(_get_measurement_service),
) -> Response:
    await service.delete(user_id=user.id, measurement_id=measurement_id)
    return Response(status_code=204)


@router.post("/measurements/{measurement_id}/photos", response_model=PhotoResponse, status_code=201)
async def upload_photo(
    measurement_id: uuid.UUID,
    file: UploadFile = File(...),
    photo_type: str = Form(default="front"),
    taken_at: str = Form(...),
    is_private: bool = Form(default=True),
    user: User = Depends(get_current_user),
    photo_service: PhotoService = Depends(_get_photo_service),
    measurement_service: MeasurementService = Depends(_get_measurement_service),
) -> PhotoResponse:
    # Verify measurement exists and belongs to user
    await measurement_service.get(user_id=user.id, measurement_id=measurement_id)

    file_bytes = await file.read()
    metadata = PhotoUpload(
        photo_type=photo_type,
        taken_at=datetime.fromisoformat(taken_at),
        is_private=is_private,
    )
    photo = await photo_service.upload(
        user_id=user.id,
        measurement_id=measurement_id,
        file_bytes=file_bytes,
        metadata=metadata,
    )
    return PhotoResponse.model_validate(photo)


@router.delete("/photos/{photo_id}", status_code=204)
async def delete_photo(
    photo_id: uuid.UUID,
    user: User = Depends(get_current_user),
    photo_service: PhotoService = Depends(_get_photo_service),
) -> Response:
    await photo_service.delete(user_id=user.id, photo_id=photo_id)
    return Response(status_code=204)
