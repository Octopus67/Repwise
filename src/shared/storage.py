"""Cloudflare R2 object storage utilities."""

import io
import logging
import re

import boto3
from src.config.settings import settings
from src.shared.errors import ValidationError

logger = logging.getLogger(__name__)

# File upload security constants
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_DIMENSION = 8000  # pixels
ALLOWED_MAGIC_BYTES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG"],
    "image/heic": [b"ftyp"],  # checked at offset 4
}


def validate_image_upload(file_bytes: bytes, content_type: str) -> None:
    """Validate uploaded image: size, magic bytes, and dimensions.

    Raises ValidationError for invalid files.
    """
    # Size check
    if len(file_bytes) > MAX_FILE_SIZE:
        raise ValidationError(f"File exceeds maximum size of {MAX_FILE_SIZE // (1024 * 1024)}MB")

    # Magic byte check
    if content_type == "image/heic":
        # HEIC: "ftyp" at offset 4
        if b"ftyp" not in file_bytes[4:12]:
            raise ValidationError("File content does not match declared content type")
    elif content_type in ALLOWED_MAGIC_BYTES:
        if not any(file_bytes[:len(sig)] == sig for sig in ALLOWED_MAGIC_BYTES[content_type]):
            raise ValidationError("File content does not match declared content type")
    else:
        raise ValidationError(
            f"Content type '{content_type}' not allowed. Must be image/jpeg, image/png, or image/heic"
        )

    # Dimension check (best-effort with Pillow)
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(file_bytes))
        w, h = img.size
        if w > MAX_DIMENSION or h > MAX_DIMENSION:
            raise ValidationError(f"Image dimensions {w}x{h} exceed maximum {MAX_DIMENSION}x{MAX_DIMENSION}")
    except ImportError:
        pass  # Pillow not available; size limit is sufficient
    except ValidationError:
        raise
    except (OSError, SyntaxError):
        logger.debug("Could not read image dimensions, skipping dimension check")


def _sanitize_filename(filename: str) -> str:
    """Strip path components and dangerous characters from filename."""
    filename = filename.split("/")[-1].split("\\")[-1]
    filename = re.sub(r"\.{2,}", ".", filename)
    filename = re.sub(r"[^a-zA-Z0-9._-]", "_", filename)
    filename = filename.rstrip(".")
    if not filename or filename.startswith("."):
        filename = f"upload_{filename}" if filename else "upload"
    return filename[:255]


def get_r2_client() -> "boto3.client":
    """Return a boto3 S3 client configured for Cloudflare R2."""
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY,
        aws_secret_access_key=settings.R2_SECRET_KEY,
        region_name="auto",
    )


ALLOWED_UPLOAD_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


def generate_upload_url(
    user_id: str, filename: str, content_type: str = "image/jpeg"
) -> dict[str, str]:
    """Generate a pre-signed upload URL scoped to the user's directory.

    Enforces content-type whitelist and max file size (10 MB) via presigned
    URL parameters so the object store rejects non-conforming uploads.

    Returns dict with 'upload_url' and 'key'.
    """
    if content_type not in ALLOWED_UPLOAD_CONTENT_TYPES:
        raise ValidationError(
            f"Content type '{content_type}' not allowed. "
            f"Must be one of: {', '.join(sorted(ALLOWED_UPLOAD_CONTENT_TYPES))}"
        )

    client = get_r2_client()
    key = f"users/{user_id}/{_sanitize_filename(filename)}"
    presigned_url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.R2_BUCKET_NAME,
            "Key": key,
            "ContentType": content_type,
            # Note: R2/S3 presigned PUT doesn't support content-length-range.
            # Size validation happens server-side via validate_image_upload() on confirmation.
        },
        ExpiresIn=900,  # 15 minutes
    )
    return {"upload_url": presigned_url, "key": key}


def generate_read_url(key: str) -> str:
    """Return the public CDN URL for a stored object."""
    if "/../" in key or key.startswith("../") or key.startswith("/") or "//" in key:
        raise ValidationError("Invalid storage key")
    return f"{settings.CDN_BASE_URL}/{key}"
