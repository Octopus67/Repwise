"""Coaching routes — requests, sessions, and document uploads.

Premium-gated request submission, admin approval, session management.
Requirements 12.1–12.5.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.middleware.authorize import require_role
from src.modules.auth.models import User
from src.modules.coaching.schemas import (
    CoachingRequestApprove,
    CoachingRequestCreate,
    CoachingRequestResponse,
    CoachingSessionResponse,
    DocumentUploadRequest,
    SessionCompleteRequest,
)
from src.modules.coaching.service import CoachingService
from src.shared.pagination import PaginatedResult, PaginationParams
from src.shared.types import SubscriptionStatus, UserRole

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> CoachingService:
    return CoachingService(db)


def _is_premium(user: User) -> bool:
    """Check if user has premium or admin role."""
    return user.role in (UserRole.PREMIUM, UserRole.ADMIN)


@router.post("/requests", response_model=CoachingRequestResponse, status_code=201)
async def submit_request(
    data: CoachingRequestCreate,
    user: User = Depends(get_current_user),
    service: CoachingService = Depends(_get_service),
) -> CoachingRequestResponse:
    """Submit a coaching request (premium users only, Requirement 12.1, 12.4, 12.7)."""
    return await service.submit_request(
        user_id=user.id,
        is_premium=_is_premium(user),
        data=data,
    )


@router.get("/requests", response_model=PaginatedResult[CoachingRequestResponse])
async def get_requests(
    user: User = Depends(get_current_user),
    service: CoachingService = Depends(_get_service),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> PaginatedResult[CoachingRequestResponse]:
    """Get coaching requests for the authenticated user."""
    pagination = PaginationParams(page=page, limit=limit)
    return await service.get_requests(user_id=user.id, pagination=pagination)


@router.post(
    "/requests/{request_id}/approve",
    response_model=CoachingSessionResponse,
)
async def approve_request(
    request_id: uuid.UUID,
    data: CoachingRequestApprove,
    user: User = Depends(require_role(UserRole.ADMIN)),
    service: CoachingService = Depends(_get_service),
) -> CoachingSessionResponse:
    """Approve a coaching request (admin only, Requirement 12.2)."""
    return await service.approve_request(
        request_id=request_id,
        admin_user_id=user.id,
        data=data,
    )


@router.post(
    "/requests/{request_id}/reject",
    response_model=CoachingRequestResponse,
)
async def reject_request(
    request_id: uuid.UUID,
    user: User = Depends(require_role(UserRole.ADMIN)),
    service: CoachingService = Depends(_get_service),
) -> CoachingRequestResponse:
    """Reject a coaching request (admin only)."""
    return await service.reject_request(
        request_id=request_id,
        admin_user_id=user.id,
    )


@router.post(
    "/requests/{request_id}/cancel",
    response_model=CoachingRequestResponse,
)
async def cancel_request(
    request_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: CoachingService = Depends(_get_service),
) -> CoachingRequestResponse:
    """Cancel a coaching request."""
    return await service.cancel_request(
        request_id=request_id,
        user_id=user.id,
    )


@router.get("/sessions", response_model=PaginatedResult[CoachingSessionResponse])
async def get_sessions(
    user: User = Depends(get_current_user),
    service: CoachingService = Depends(_get_service),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> PaginatedResult[CoachingSessionResponse]:
    """Get coaching sessions for the authenticated user."""
    pagination = PaginationParams(page=page, limit=limit)
    return await service.get_sessions(user_id=user.id, pagination=pagination)


@router.post(
    "/sessions/{session_id}/complete",
    response_model=CoachingSessionResponse,
)
async def complete_session(
    session_id: uuid.UUID,
    data: SessionCompleteRequest,
    user: User = Depends(get_current_user),
    service: CoachingService = Depends(_get_service),
) -> CoachingSessionResponse:
    """Complete a coaching session (Requirement 12.3)."""
    return await service.complete_session(
        session_id=session_id,
        user_id=user.id,
        data=data,
    )


@router.post(
    "/sessions/{session_id}/documents",
    response_model=CoachingSessionResponse,
)
async def upload_document(
    session_id: uuid.UUID,
    data: DocumentUploadRequest,
    user: User = Depends(get_current_user),
    service: CoachingService = Depends(_get_service),
) -> CoachingSessionResponse:
    """Upload a document to a coaching session (Requirement 12.5)."""
    return await service.upload_document(
        session_id=session_id,
        user_id=user.id,
        data=data,
    )
