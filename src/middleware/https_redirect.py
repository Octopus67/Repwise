"""HTTPS redirect middleware for production."""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import RedirectResponse, Response


class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    """Redirect HTTP requests to HTTPS in production."""

    async def dispatch(self, request: Request, call_next) -> Response:
        # Check if request is HTTP (not HTTPS)
        if request.url.scheme == "http":
            # Allow localhost (development)
            if request.url.hostname in ("localhost", "127.0.0.1"):
                return await call_next(request)
            
            # Allow health checks on HTTP
            if request.url.path == "/api/v1/health":
                return await call_next(request)
            
            # Redirect to HTTPS
            url = request.url.replace(scheme="https")
            return RedirectResponse(url=str(url), status_code=307)
        
        return await call_next(request)
