"""Middleware to enforce per-request timeouts."""

import asyncio
import logging

import sentry_sdk
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 30  # seconds
LONG_TIMEOUT = 120  # seconds for export/report endpoints
LONG_TIMEOUT_PATHS = ("/export/", "/reports/")


class RequestTimeoutMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        timeout = LONG_TIMEOUT if any(p in path for p in LONG_TIMEOUT_PATHS) else DEFAULT_TIMEOUT
        try:
            async with asyncio.timeout(timeout):
                return await call_next(request)
        except TimeoutError:
            logger.error("Request timed out: %s %s (%ds)", request.method, path, timeout)
            sentry_sdk.capture_message(
                f"Request timeout: {request.method} {path} ({timeout}s)",
                level="error",
            )
            return JSONResponse(
                status_code=504,
                content={"status": 504, "code": "GATEWAY_TIMEOUT", "message": "Request timed out"},
            )
