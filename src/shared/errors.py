"""Custom exception classes and error codes."""

from __future__ import annotations

from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel


class ErrorCode:
    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    PREMIUM_REQUIRED = "PREMIUM_REQUIRED"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    UNPROCESSABLE = "UNPROCESSABLE"
    RATE_LIMITED = "RATE_LIMITED"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    PROVIDER_ERROR = "PROVIDER_ERROR"


class ApiErrorResponse(BaseModel):
    """Structured error response returned by the API."""

    status: int
    code: str
    message: str
    details: Optional[Any] = None
    request_id: str


class ApiError(Exception):
    """Base API exception that maps to a structured error response."""

    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        details: Optional[Any] = None,
        request_id: Optional[str] = None,
    ) -> None:
        self.status = status
        self.code = code
        self.message = message
        self.details = details
        self.request_id = request_id or str(uuid4())
        super().__init__(message)

    def to_response(self) -> ApiErrorResponse:
        return ApiErrorResponse(
            status=self.status,
            code=self.code,
            message=self.message,
            details=self.details,
            request_id=self.request_id,
        )


class ValidationError(ApiError):
    def __init__(self, message: str = "Validation failed", details: Optional[Any] = None) -> None:
        super().__init__(400, ErrorCode.VALIDATION_ERROR, message, details)


class UnauthorizedError(ApiError):
    def __init__(self, message: str = "Authentication required") -> None:
        super().__init__(401, ErrorCode.UNAUTHORIZED, message)


class ForbiddenError(ApiError):
    def __init__(self, message: str = "Insufficient permissions") -> None:
        super().__init__(403, ErrorCode.FORBIDDEN, message)


class PremiumRequiredError(ApiError):
    def __init__(self, message: str = "Active subscription required") -> None:
        super().__init__(403, ErrorCode.PREMIUM_REQUIRED, message)


class NotFoundError(ApiError):
    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(404, ErrorCode.NOT_FOUND, message)


class ConflictError(ApiError):
    def __init__(self, message: str = "Resource already exists") -> None:
        super().__init__(409, ErrorCode.CONFLICT, message)


class UnprocessableError(ApiError):
    def __init__(self, message: str = "Unprocessable entity", details: Optional[Any] = None) -> None:
        super().__init__(422, ErrorCode.UNPROCESSABLE, message, details)


class RateLimitedError(ApiError):
    def __init__(self, message: str = "Too many requests", retry_after: int = 900) -> None:
        super().__init__(429, ErrorCode.RATE_LIMITED, message, details={"retry_after": retry_after})


class InternalError(ApiError):
    def __init__(self, message: str = "Internal server error") -> None:
        super().__init__(500, ErrorCode.INTERNAL_ERROR, message)


class ProviderError(ApiError):
    def __init__(self, message: str = "External service error") -> None:
        super().__init__(502, ErrorCode.PROVIDER_ERROR, message)


# Convenience aliases referenced in task descriptions
AuthenticationError = UnauthorizedError
AuthorizationError = ForbiddenError
