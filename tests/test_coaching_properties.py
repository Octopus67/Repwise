"""Property-based tests for the coaching module.

Property 22: Coaching status transitions — generate random status
transition attempts, verify only valid transitions succeed.

**Validates: Requirements 12.2, 12.3**
"""

from __future__ import annotations

import uuid

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st

from src.modules.coaching.models import CoachingRequest, CoachingSession, CoachProfile
from src.modules.coaching.service import (
    CoachingService,
    validate_request_transition,
    validate_session_transition,
    VALID_REQUEST_TRANSITIONS,
    VALID_SESSION_TRANSITIONS,
)
from src.modules.coaching.schemas import (
    CoachingRequestApprove,
    CoachingRequestCreate,
    SessionCompleteRequest,
)
from src.shared.errors import PremiumRequiredError, UnprocessableError
from src.shared.types import CoachingRequestStatus, CoachingSessionStatus


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_all_request_statuses = st.sampled_from(list(CoachingRequestStatus))
_all_session_statuses = st.sampled_from(list(CoachingSessionStatus))

_fixture_settings = h_settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)


# ---------------------------------------------------------------------------
# Property 22: Coaching status transitions
# ---------------------------------------------------------------------------


class TestProperty22CoachingStatusTransitions:
    """Property 22: Coaching status transitions.

    Generate random status transition attempts, verify only valid
    transitions succeed.

    **Validates: Requirements 12.2, 12.3**
    """

    # ---- Pure function tests (no DB needed) ----

    @given(
        current=_all_request_statuses,
        target=_all_request_statuses,
    )
    def test_request_transition_validation(
        self,
        current: str,
        target: str,
    ):
        """For any pair of request statuses, validate_request_transition
        succeeds iff the transition is in VALID_REQUEST_TRANSITIONS.

        **Validates: Requirements 12.2**
        """
        allowed = VALID_REQUEST_TRANSITIONS.get(current, set())
        if target in allowed:
            # Should not raise
            validate_request_transition(current, target)
        else:
            with pytest.raises(UnprocessableError):
                validate_request_transition(current, target)

    @given(
        current=_all_session_statuses,
        target=_all_session_statuses,
    )
    def test_session_transition_validation(
        self,
        current: str,
        target: str,
    ):
        """For any pair of session statuses, validate_session_transition
        succeeds iff the transition is in VALID_SESSION_TRANSITIONS.

        **Validates: Requirements 12.3**
        """
        allowed = VALID_SESSION_TRANSITIONS.get(current, set())
        if target in allowed:
            validate_session_transition(current, target)
        else:
            with pytest.raises(UnprocessableError):
                validate_session_transition(current, target)

    # ---- Integration tests via service layer ----

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        current=_all_request_statuses,
        target=_all_request_statuses,
    )
    async def test_request_transitions_via_service(
        self,
        current: str,
        target: str,
        db_session,
    ):
        """Create a coaching request with a given status, attempt a
        transition, and verify the outcome matches the transition map.

        **Validates: Requirements 12.2**
        """
        user_id = uuid.uuid4()
        service = CoachingService(db_session)

        # Seed a request directly at the desired current status
        request = CoachingRequest(
            user_id=user_id,
            status=current,
            goals="Test goals",
            progress_data={},
            document_urls=[],
        )
        db_session.add(request)
        await db_session.flush()

        allowed = VALID_REQUEST_TRANSITIONS.get(current, set())

        if target == CoachingRequestStatus.APPROVED and target in allowed:
            # Need a coach profile for approval
            coach = CoachProfile(user_id=uuid.uuid4(), is_active=True)
            db_session.add(coach)
            await db_session.flush()

            result = await service.approve_request(
                request_id=request.id,
                admin_user_id=uuid.uuid4(),
                data=CoachingRequestApprove(coach_id=coach.id),
            )
            assert request.status == CoachingRequestStatus.APPROVED

        elif target == CoachingRequestStatus.REJECTED and target in allowed:
            result = await service.reject_request(
                request_id=request.id,
                admin_user_id=uuid.uuid4(),
            )
            assert request.status == CoachingRequestStatus.REJECTED

        elif target == CoachingRequestStatus.CANCELLED and target in allowed:
            result = await service.cancel_request(
                request_id=request.id,
                user_id=user_id,
            )
            assert request.status == CoachingRequestStatus.CANCELLED

        elif target not in allowed:
            # For invalid transitions, we test the pure validator
            with pytest.raises(UnprocessableError):
                validate_request_transition(current, target)

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        current=_all_session_statuses,
        target=_all_session_statuses,
    )
    async def test_session_transitions_via_service(
        self,
        current: str,
        target: str,
        db_session,
    ):
        """Create a coaching session with a given status, attempt a
        transition to completed, and verify the outcome.

        **Validates: Requirements 12.3**
        """
        user_id = uuid.uuid4()
        service = CoachingService(db_session)

        # Seed prerequisite objects
        request = CoachingRequest(
            user_id=user_id,
            status=CoachingRequestStatus.APPROVED,
            goals="Test goals",
            progress_data={},
            document_urls=[],
        )
        db_session.add(request)
        await db_session.flush()

        coach = CoachProfile(user_id=uuid.uuid4(), is_active=True)
        db_session.add(coach)
        await db_session.flush()

        session = CoachingSession(
            request_id=request.id,
            coach_id=coach.id,
            status=current,
            document_urls=[],
        )
        db_session.add(session)
        await db_session.flush()

        # Test completing a session — the service auto-transitions
        # scheduled → in_progress → completed
        if target == CoachingSessionStatus.COMPLETED:
            if current in (
                CoachingSessionStatus.SCHEDULED,
                CoachingSessionStatus.IN_PROGRESS,
            ):
                result = await service.complete_session(
                    session_id=session.id,
                    user_id=user_id,
                    data=SessionCompleteRequest(notes="Done"),
                )
                assert session.status == CoachingSessionStatus.COMPLETED
            else:
                with pytest.raises(UnprocessableError):
                    await service.complete_session(
                        session_id=session.id,
                        user_id=user_id,
                        data=SessionCompleteRequest(notes="Done"),
                    )
        else:
            # For all other transitions, verify via pure validator
            allowed = VALID_SESSION_TRANSITIONS.get(current, set())
            if target in allowed:
                validate_session_transition(current, target)
            else:
                with pytest.raises(UnprocessableError):
                    validate_session_transition(current, target)


class TestCoachingPremiumGating:
    """Verify that non-premium users cannot submit coaching requests.

    **Validates: Requirements 12.4, 12.7**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        goals=st.text(min_size=1, max_size=200).filter(lambda s: s.strip()),
    )
    async def test_non_premium_user_rejected(
        self,
        goals: str,
        db_session,
    ):
        """Non-premium users should get PremiumRequiredError."""
        service = CoachingService(db_session)
        with pytest.raises(PremiumRequiredError):
            await service.submit_request(
                user_id=uuid.uuid4(),
                is_premium=False,
                data=CoachingRequestCreate(goals=goals),
            )

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        goals=st.text(min_size=1, max_size=200).filter(lambda s: s.strip()),
    )
    async def test_premium_user_accepted(
        self,
        goals: str,
        db_session,
    ):
        """Premium users should successfully create a request."""
        service = CoachingService(db_session)
        result = await service.submit_request(
            user_id=uuid.uuid4(),
            is_premium=True,
            data=CoachingRequestCreate(goals=goals),
        )
        assert result.status == CoachingRequestStatus.PENDING
        assert result.goals == goals
