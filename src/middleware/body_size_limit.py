"""Middleware to enforce request body size limits."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

# 1 MB default for JSON API requests
DEFAULT_MAX_BODY_SIZE = 1 * 1024 * 1024
# 10 MB for file upload endpoints
UPLOAD_MAX_BODY_SIZE = 10 * 1024 * 1024


def _is_upload_path(path: str) -> bool:
    """Check if the path is a file upload endpoint."""
    upload_prefixes = (
        "/api/v1/body-measurements/",  # /{id}/photos
        "/api/v1/progress-photos/",     # /upload-url
        "/api/v1/coaching/",            # /sessions/{id}/documents
    )
    return any(path.startswith(p) for p in upload_prefixes)


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method in ("POST", "PUT", "PATCH"):
            content_length = request.headers.get("content-length")
            max_size = UPLOAD_MAX_BODY_SIZE if _is_upload_path(request.url.path) else DEFAULT_MAX_BODY_SIZE
            # Reject requests without Content-Length (blocks chunked encoding).
            # Acceptable for mobile-first API; clients always send Content-Length.
            if content_length is None:
                return JSONResponse(
                    status_code=411,
                    content={"detail": "Content-Length header required"},
                )
            try:
                size = int(content_length)
            except (ValueError, TypeError):
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Invalid Content-Length header"},
                )
            if size > max_size:
                return JSONResponse(
                    status_code=413,
                    content={"detail": f"Request body too large. Maximum: {max_size // (1024 * 1024)}MB"},
                )

            # Streaming safety net: track actual bytes read in case Content-Length lies
            original_receive = request._receive
            bytes_read = 0

            async def _counting_receive():
                nonlocal bytes_read
                message = await original_receive()
                body = message.get("body", b"")
                bytes_read += len(body)
                if bytes_read > max_size:
                    raise _BodyTooLargeError()
                return message

            request._receive = _counting_receive

            try:
                return await call_next(request)
            except _BodyTooLargeError:
                return JSONResponse(
                    status_code=413,
                    content={"detail": f"Request body too large. Maximum: {max_size // (1024 * 1024)}MB"},
                )

        return await call_next(request)


class _BodyTooLargeError(Exception):
    """Raised when streaming body exceeds the size limit."""
