"""Business logic for measurement progress photo uploads."""

from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.measurements.models import MeasurementProgressPhoto
from src.modules.measurements.schemas import PhotoUpload
from src.shared.errors import NotFoundError, ValidationError

logger = logging.getLogger(__name__)

UPLOAD_ROOT = os.environ.get("UPLOAD_ROOT", "uploads")
PHOTO_SUBDIR = "progress_photos"

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png"}
MAGIC_BYTES = {
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
}


def _validate_upload(file_bytes: bytes, content_type: str) -> None:
    """Validate file size, content-type whitelist, and magic bytes."""
    if len(file_bytes) > MAX_FILE_SIZE:
        raise ValidationError(f"File exceeds maximum size of {MAX_FILE_SIZE} bytes")
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationError(
            f"Content type '{content_type}' not allowed. Must be one of: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}"
        )
    for sig in MAGIC_BYTES[content_type]:
        if file_bytes[: len(sig)] == sig:
            return
    raise ValidationError("File content does not match declared content type")


class PhotoService:
    """Service layer for measurement progress photo operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upload(
        self,
        user_id: uuid.UUID,
        measurement_id: uuid.UUID,
        file_bytes: bytes,
        metadata: PhotoUpload,
        content_type: str = "image/jpeg",
    ) -> MeasurementProgressPhoto:
        """Save photo to local filesystem and create DB record."""
        _validate_upload(file_bytes, content_type)

        photo_id = uuid.uuid4()
        ext = "png" if content_type == "image/png" else "jpg"
        rel_dir = os.path.join(UPLOAD_ROOT, PHOTO_SUBDIR, str(user_id))
        Path(rel_dir).mkdir(parents=True, exist_ok=True)

        filename = f"{photo_id}.{ext}"
        filepath = os.path.join(rel_dir, filename)

        with open(filepath, "wb") as f:
            f.write(file_bytes)

        photo_url = f"/{PHOTO_SUBDIR}/{user_id}/{filename}"

        photo = MeasurementProgressPhoto(
            id=photo_id,
            user_id=user_id,
            measurement_id=measurement_id,
            photo_url=photo_url,
            photo_type=metadata.photo_type,
            taken_at=metadata.taken_at,
            is_private=metadata.is_private,
        )
        self.session.add(photo)
        await self.session.flush()
        logger.info("Uploaded photo %s for measurement %s", photo_id, measurement_id)
        return photo

    async def get(self, user_id: uuid.UUID, photo_id: uuid.UUID) -> MeasurementProgressPhoto:
        stmt = select(MeasurementProgressPhoto).where(
            MeasurementProgressPhoto.id == photo_id,
            MeasurementProgressPhoto.user_id == user_id,
        )
        result = await self.session.execute(stmt)
        photo = result.scalar_one_or_none()
        if photo is None:
            raise NotFoundError("Photo not found")
        return photo

    async def delete(self, user_id: uuid.UUID, photo_id: uuid.UUID) -> None:
        photo = await self.get(user_id, photo_id)

        # Remove file from disk
        filepath = os.path.join(UPLOAD_ROOT, photo.photo_url.lstrip("/"))
        if os.path.exists(filepath):
            os.remove(filepath)

        await self.session.delete(photo)
        await self.session.flush()
        logger.info("Deleted photo %s for user %s", photo_id, user_id)
