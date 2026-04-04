"""Export router — GDPR Article 20 data portability endpoints."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.middleware.rate_limiter import check_user_endpoint_rate_limit
from src.modules.auth.models import User
from src.modules.export.schemas import ExportRequestCreate, ExportRequestResponse
from src.modules.export.service import ExportService, EXPORTS_DIR

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> ExportService:
    return ExportService(db)


@router.post("/request", response_model=ExportRequestResponse)
async def request_export(
    body: ExportRequestCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    service: ExportService = Depends(_get_service),
) -> ExportRequestResponse:
    """Request a data export (JSON, CSV, or PDF). Rate limited to 1 per 24h."""
    check_user_endpoint_rate_limit(str(user.id), "export:request", 5, 60)
    export = await service.request_export(user.id, body.format)

    # Schedule background generation
    async def _run_export():
        from src.config.database import async_session_factory
        async with async_session_factory() as session:
            svc = ExportService(session)
            await svc.generate_export(export.id)
            await session.commit()

    background_tasks.add_task(_run_export)

    return ExportRequestResponse(
        id=str(export.id),
        format=export.format,
        status=export.status,
        requested_at=export.requested_at,
        completed_at=export.completed_at,
        expires_at=export.expires_at,
        downloaded_at=export.downloaded_at,
    )


@router.get("/status/{export_id}", response_model=ExportRequestResponse)
async def get_export_status(
    export_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: ExportService = Depends(_get_service),
) -> ExportRequestResponse:
    """Check the status of an export request."""
    export = await service.get_export(export_id, user.id)
    return ExportRequestResponse(
        id=str(export.id),
        format=export.format,
        status=export.status,
        file_size_bytes=export.file_size_bytes,
        error_message=export.error_message,
        requested_at=export.requested_at,
        completed_at=export.completed_at,
        expires_at=export.expires_at,
        downloaded_at=export.downloaded_at,
    )


@router.get("/download/{export_id}")
async def download_export(
    export_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: ExportService = Depends(_get_service),
):
    """Download a completed export file."""
    check_user_endpoint_rate_limit(str(user.id), "export:download", 5, 60)
    export = await service.mark_downloaded(export_id, user.id)

    path = Path(export.download_url).resolve()
    exports_root = EXPORTS_DIR.resolve()
    if not str(path).startswith(str(exports_root)):
        from src.shared.errors import NotFoundError
        raise NotFoundError("Export file not found on disk")
    if not path.exists():
        from src.shared.errors import NotFoundError
        raise NotFoundError("Export file not found on disk")

    media_types = {
        "json": "application/json",
        "csv": "application/zip",
        "pdf": "application/pdf",
    }
    return FileResponse(
        path=str(path),
        media_type=media_types.get(export.format, "application/octet-stream"),
        filename=f"repwise-export-{export_id}.{_ext(export.format)}",
    )


@router.get("/history", response_model=list[ExportRequestResponse])
async def get_export_history(
    user: User = Depends(get_current_user),
    service: ExportService = Depends(_get_service),
) -> list[ExportRequestResponse]:
    """List all export requests for the current user."""
    exports = await service.get_history(user.id)
    return [
        ExportRequestResponse(
            id=str(e.id),
            format=e.format,
            status=e.status,
            file_size_bytes=e.file_size_bytes,
            error_message=e.error_message,
            requested_at=e.requested_at,
            completed_at=e.completed_at,
            expires_at=e.expires_at,
            downloaded_at=e.downloaded_at,
        )
        for e in exports
    ]


@router.delete("/{export_id}", status_code=204, response_model=None)
async def delete_export(
    export_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: ExportService = Depends(_get_service),
):
    """Delete an export request and its file."""
    await service.delete_export(export_id, user.id)
    return Response(status_code=204)


def _ext(fmt: str) -> str:
    return "zip" if fmt == "csv" else fmt
