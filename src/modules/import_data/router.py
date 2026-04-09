"""Import router — CSV file upload, preview, and execute endpoints."""

from __future__ import annotations


from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.middleware.rate_limiter import check_user_endpoint_rate_limit
from src.modules.auth.models import User
from src.modules.import_data.schemas import ImportPreviewResponse, ImportResultResponse
from src.modules.import_data.service import ImportService
from src.shared.errors import ValidationError

router = APIRouter()

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

SUPPORTED_FORMATS = [
    {"id": "strong", "name": "Strong", "extension": ".csv"},
    {"id": "hevy", "name": "Hevy", "extension": ".csv"},
    {"id": "fitnotes", "name": "FitNotes", "extension": ".csv"},
]


async def _read_file(file: UploadFile) -> str:
    """Read and validate uploaded file."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise ValidationError(message="Only .csv files are accepted")
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise ValidationError(message="File exceeds 5MB limit")
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        raise ValidationError(message="File must be UTF-8 encoded CSV")


@router.get("/formats")
async def get_formats(user: User = Depends(get_current_user)):
    """Return supported import formats."""
    return SUPPORTED_FORMATS


@router.post("/preview", response_model=ImportPreviewResponse)
async def preview_import(
    file: UploadFile = File(...),
    weight_unit: str = Form("kg"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ImportPreviewResponse:
    """Parse CSV and return preview without saving."""
    text = await _read_file(file)
    service = ImportService(db)
    return await service.preview_import(text, weight_unit, user.id)


@router.post("/execute", response_model=ImportResultResponse)
async def execute_import(
    file: UploadFile = File(...),
    weight_unit: str = Form("kg"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ImportResultResponse:
    """Execute CSV import — rate limited to 3 per hour."""
    await check_user_endpoint_rate_limit(str(user.id), "import:execute", 3, 3600)
    text = await _read_file(file)
    service = ImportService(db)
    result = await service.execute_import(user.id, text, weight_unit)
    await db.commit()
    return result
