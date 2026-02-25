"""Cloudflare R2 object storage utilities."""

import boto3
from src.config.settings import settings


def get_r2_client():
    """Return a boto3 S3 client configured for Cloudflare R2."""
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY,
        aws_secret_access_key=settings.R2_SECRET_KEY,
        region_name="auto",
    )


def generate_upload_url(
    user_id: str, filename: str, content_type: str = "image/jpeg"
) -> dict:
    """Generate a pre-signed upload URL scoped to the user's directory.

    Returns dict with 'upload_url' and 'key'.
    """
    client = get_r2_client()
    key = f"users/{user_id}/{filename}"
    presigned_url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.R2_BUCKET_NAME,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=900,  # 15 minutes
    )
    return {"upload_url": presigned_url, "key": key}


def generate_read_url(key: str) -> str:
    """Return the public CDN URL for a stored object."""
    return f"https://cdn.hypertrophyos.com/{key}"
