"""Business logic for the coaching system.

Handles coaching requests, sessions, coach profiles, and status
transition validation (Requirements 12.1–12.7).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.coaching.models import CoachingRequest, CoachingSession, CoachProfile
from src.modules.coaching.schemas import (
    CoachingRequestApprove,
    CoachingRequestCreate,
    CoachingRequestResponse,
    CoachingSessionResponse,
    DocumentUploadRequest,
    SessionCompleteRequest,
)
from src.shared.errors import NotFoundError, PremiumRequiredError, UnprocessableError
from src.shared.pagination import PaginatedResult, PaginationParams
from src.shared.types import AuditAction, CoachingRequestStatus, CoachingSessionStatus


# Valid status transitions per the design document (Property 22)
VALID_REQUEST_TRANSITIONS: dict[str, set[str]] = {
    CoachingRequestStatus.PENDING: {
        CoachingRequestStatus.APPROVED,
        CoachingRequestStatus.REJECTED,
        CoachingRequestStatus.CANCELLED,
    },
}

VALID_SESSION_TRANSITIONS: dict[str, set[str]] = {
    CoachingSessionStatus.SCHEDULED: {
        CoachingSessionStatus.IN_PROGRESS,
        CoachingSessionStatus.CANCELLED,
    },
    CoachingSessionStatus.IN_PROGRESS: {
        CoachingSessionStatus.COMPLETED,
        CoachingSessionStatus.CANCELLED,
    },
}


def validate_request_transition(current: str, target: str) -> None:
    """Raise UnprocessableError if the request status transition is invalid."""
    allowed = VALID_REQUEST_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise UnprocessableError(
            f"Invalid coaching request transition: {current} → {target}",
            details={"current_status": current, "target_status": target},
        )


def validate_session_transition(current: str, target: str) -> None:
    """Raise UnprocessableError if the session status transition is invalid."""
    allowed = VALID_SESSION_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise UnprocessableError(
            f"Invalid coaching session transition: {current} → {target}",
            details={"current_status": current, "target_status": target},
        )


class CoachingService:
    """Service layer for coaching operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ------------------------------------------------------------------
    # Coaching Requests
    # ------------------------------------------------------------------

    async def submit_request(
        self,
        user_id: uuid.UUID,
        is_premium: bool,
        data: CoachingRequestCreate,
    ) -> CoachingRequestResponse:
        """Submit a coaching request (premium-gated, Requirement 12.1, 12.4, 12.7)."""
        if not is_premium:
            raise PremiumRequiredError(
                "Active subscription required to submit coaching requests"
            )

        request = CoachingRequest(
            user_id=user_id,
            status=CoachingRequestStatus.PENDING,
            goals=data.goals,
            progress_data=data.progress_data,
            document_urls=[],
        )
        self.session.add(request)
        await self.session.flush()
        await self.session.refresh(request)

        await CoachingRequest.write_audit(
            self.session,
            user_id=user_id,
            action=AuditAction.CREATE,
            entity_id=request.id,
            changes={"goals": data.goals},
        )

        return CoachingRequestResponse.model_validate(request)

    async def approve_request(
        self,
        request_id: uuid.UUID,
        admin_user_id: uuid.UUID,
        data: CoachingRequestApprove,
    ) -> CoachingSessionResponse:
        """Approve a coaching request and create a session (Requirement 12.2)."""
        request = await self._get_request_or_404(request_id)
        validate_request_transition(request.status, CoachingRequestStatus.APPROVED)

        # Verify coach exists
        coach = await self._get_coach_or_404(data.coach_id)

        request.status = CoachingRequestStatus.APPROVED
        await CoachingRequest.write_audit(
            self.session,
            user_id=admin_user_id,
            action=AuditAction.UPDATE,
            entity_id=request.id,
            changes={"status": {"old": "pending", "new": "approved"}},
        )

        session = CoachingSession(
            request_id=request.id,
            coach_id=coach.id,
            status=CoachingSessionStatus.SCHEDULED,
            scheduled_at=data.scheduled_at,
            document_urls=[],
        )
        self.session.add(session)
        await self.session.flush()
        await self.session.refresh(session)

        await CoachingSession.write_audit(
            self.session,
            user_id=admin_user_id,
            action=AuditAction.CREATE,
            entity_id=session.id,
            changes={"request_id": str(request.id)},
        )

        return CoachingSessionResponse.model_validate(session)

    async def reject_request(
        self,
        request_id: uuid.UUID,
        admin_user_id: uuid.UUID,
    ) -> CoachingRequestResponse:
        """Reject a coaching request."""
        request = await self._get_request_or_404(request_id)
        validate_request_transition(request.status, CoachingRequestStatus.REJECTED)
        request.status = CoachingRequestStatus.REJECTED

        await CoachingRequest.write_audit(
            self.session,
            user_id=admin_user_id,
            action=AuditAction.UPDATE,
            entity_id=request.id,
            changes={"status": {"old": "pending", "new": "rejected"}},
        )
        await self.session.flush()
        await self.session.refresh(request)
        return CoachingRequestResponse.model_validate(request)

    async def cancel_request(
        self,
        request_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> CoachingRequestResponse:
        """Cancel a coaching request."""
        request = await self._get_request_or_404(request_id)
        validate_request_transition(request.status, CoachingRequestStatus.CANCELLED)
        request.status = CoachingRequestStatus.CANCELLED

        await CoachingRequest.write_audit(
            self.session,
            user_id=user_id,
            action=AuditAction.UPDATE,
            entity_id=request.id,
            changes={"status": {"old": request.status, "new": "cancelled"}},
        )
        await self.session.flush()
        await self.session.refresh(request)
        return CoachingRequestResponse.model_validate(request)

    async def get_requests(
        self,
        user_id: uuid.UUID,
        pagination: PaginationParams,
    ) -> PaginatedResult[CoachingRequestResponse]:
        """Get coaching requests for a user (Requirement 12.1)."""
        base = select(CoachingRequest).where(CoachingRequest.user_id == user_id)

        count_stmt = select(func.count()).select_from(base.subquery())
        total_count = (await self.session.execute(count_stmt)).scalar_one()

        items_stmt = (
            base.order_by(CoachingRequest.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        result = await self.session.execute(items_stmt)
        items = list(result.scalars().all())

        return PaginatedResult[CoachingRequestResponse](
            items=[CoachingRequestResponse.model_validate(r) for r in items],
            total_count=total_count,
            page=pagination.page,
            limit=pagination.limit,
        )

    # ------------------------------------------------------------------
    # Coaching Sessions
    # ------------------------------------------------------------------

    async def complete_session(
        self,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        data: SessionCompleteRequest,
    ) -> CoachingSessionResponse:
        """Complete a coaching session (Requirement 12.3)."""
        session = await self._get_session_or_404(session_id)

        # Must transition through in_progress first if currently scheduled
        if session.status == CoachingSessionStatus.SCHEDULED:
            validate_session_transition(session.status, CoachingSessionStatus.IN_PROGRESS)
            session.status = CoachingSessionStatus.IN_PROGRESS

        validate_session_transition(session.status, CoachingSessionStatus.COMPLETED)
        session.status = CoachingSessionStatus.COMPLETED
        session.notes = data.notes
        session.completed_at = datetime.now(timezone.utc)

        await CoachingSession.write_audit(
            self.session,
            user_id=user_id,
            action=AuditAction.UPDATE,
            entity_id=session.id,
            changes={"status": {"old": "in_progress", "new": "completed"}},
        )
        await self.session.flush()
        await self.session.refresh(session)
        return CoachingSessionResponse.model_validate(session)

    async def get_sessions(
        self,
        user_id: uuid.UUID,
        pagination: PaginationParams,
    ) -> PaginatedResult[CoachingSessionResponse]:
        """Get coaching sessions for requests owned by the user."""
        base = (
            select(CoachingSession)
            .join(CoachingRequest, CoachingSession.request_id == CoachingRequest.id)
            .where(CoachingRequest.user_id == user_id)
        )

        count_stmt = select(func.count()).select_from(base.subquery())
        total_count = (await self.session.execute(count_stmt)).scalar_one()

        items_stmt = (
            base.order_by(CoachingSession.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        result = await self.session.execute(items_stmt)
        items = list(result.scalars().all())

        return PaginatedResult[CoachingSessionResponse](
            items=[CoachingSessionResponse.model_validate(s) for s in items],
            total_count=total_count,
            page=pagination.page,
            limit=pagination.limit,
        )

    async def upload_document(
        self,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        data: DocumentUploadRequest,
    ) -> CoachingSessionResponse:
        """Attach a document URL to a coaching session (Requirement 12.5)."""
        session = await self._get_session_or_404(session_id)

        docs = list(session.document_urls or [])
        docs.append(data.document_url)
        session.document_urls = docs

        await CoachingSession.write_audit(
            self.session,
            user_id=user_id,
            action=AuditAction.UPDATE,
            entity_id=session.id,
            changes={"document_urls": {"added": data.document_url}},
        )
        await self.session.flush()
        await self.session.refresh(session)
        return CoachingSessionResponse.model_validate(session)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_request_or_404(self, request_id: uuid.UUID) -> CoachingRequest:
        stmt = select(CoachingRequest).where(CoachingRequest.id == request_id)
        result = await self.session.execute(stmt)
        request = result.scalar_one_or_none()
        if request is None:
            raise NotFoundError("Coaching request not found")
        return request

    async def _get_session_or_404(self, session_id: uuid.UUID) -> CoachingSession:
        stmt = select(CoachingSession).where(CoachingSession.id == session_id)
        result = await self.session.execute(stmt)
        session = result.scalar_one_or_none()
        if session is None:
            raise NotFoundError("Coaching session not found")
        return session

    async def _get_coach_or_404(self, coach_id: uuid.UUID) -> CoachProfile:
        stmt = select(CoachProfile).where(
            CoachProfile.id == coach_id, CoachProfile.is_active.is_(True)
        )
        result = await self.session.execute(stmt)
        coach = result.scalar_one_or_none()
        if coach is None:
            raise NotFoundError("Coach profile not found or inactive")
        return coach
