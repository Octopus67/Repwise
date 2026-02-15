"""Global request/response validation middleware.

Provides Pydantic-based request validation and a global exception handler
that returns errors in the ApiError format.

Requirement 20.1: Serialize all responses as JSON.
Requirement 20.2: Deserialize and validate all request bodies.
Requirement 20.4: Return 400 with validation failure details.
"""

from __future__ import annotations

from uuid import uuid4

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError as PydanticValidationError

from src.shared.errors import ApiErrorResponse, ErrorCode


async def validation_exception_handler(
    _request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Handle Pydantic/FastAPI request validation errors.

    Converts FastAPI's RequestValidationError into the standard ApiError
    response format with detailed field-level error information.

    Requirement 20.4: Return 400 with details of validation failures.
    """
    details = []
    for error in exc.errors():
        loc = " → ".join(str(part) for part in error.get("loc", []))
        details.append({
            "field": loc,
            "message": error.get("msg", "Validation error"),
            "type": error.get("type", "value_error"),
        })

    response = ApiErrorResponse(
        status=400,
        code=ErrorCode.VALIDATION_ERROR,
        message="Request validation failed",
        details=details,
        request_id=str(uuid4()),
    )
    return JSONResponse(
        status_code=400,
        content=response.model_dump(),
    )


async def pydantic_validation_exception_handler(
    _request: Request,
    exc: PydanticValidationError,
) -> JSONResponse:
    """Handle raw Pydantic ValidationError (not wrapped by FastAPI).

    This catches cases where Pydantic validation fails outside of
    FastAPI's normal request parsing flow.
    """
    details = []
    for error in exc.errors():
        loc = " → ".join(str(part) for part in error.get("loc", []))
        details.append({
            "field": loc,
            "message": error.get("msg", "Validation error"),
            "type": error.get("type", "value_error"),
        })

    response = ApiErrorResponse(
        status=400,
        code=ErrorCode.VALIDATION_ERROR,
        message="Data validation failed",
        details=details,
        request_id=str(uuid4()),
    )
    return JSONResponse(
        status_code=400,
        content=response.model_dump(),
    )
