"""Structured JSON logging middleware for HTTP requests."""

import contextvars
import json
import logging
import time
import uuid
from urllib.parse import parse_qs, urlencode

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("hypertrophy_os.access")

# Phase 3 — F14: shared request ID context var
request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="")

_SENSITIVE_PARAMS = frozenset({"token", "code", "email", "password", "secret"})


def _scrub_path(url_path: str, query_string: str) -> str:
    """Strip sensitive query params from the path for logging."""
    if not query_string:
        return url_path
    params = parse_qs(query_string, keep_blank_values=True)
    for key in params:
        if key.lower() in _SENSITIVE_PARAMS:
            params[key] = ["[REDACTED]"]
    return f"{url_path}?{urlencode(params, doseq=True)}"


class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())
        request_id_ctx.set(request_id)
        start = time.monotonic()

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id

        duration_ms = round((time.monotonic() - start) * 1000)

        # Phase 3 — F21: scrub sensitive query params before logging
        safe_path = _scrub_path(
            request.url.path,
            request.url.query.decode("utf-8")
            if isinstance(request.url.query, bytes)
            else (request.url.query or ""),
        )

        logger.info(
            json.dumps(
                {
                    "request_id": request_id,
                    "method": request.method,
                    "path": safe_path,
                    "status": response.status_code,
                    "duration_ms": duration_ms,
                    "user_id": getattr(request.state, "user_id", None),
                }
            )
        )

        return response
