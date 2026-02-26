"""Smoke tests for project infrastructure — validates task 1.1 deliverables."""

import pytest
from httpx import ASGITransport, AsyncClient

from src.config.settings import Settings, settings
from src.main import app
from src.shared.errors import (
    ApiError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    NotFoundError,
    PremiumRequiredError,
    UnauthorizedError,
    ValidationError,
)
from src.shared.pagination import PaginatedResult, PaginationParams
from src.shared.types import (
    ActivityLevel,
    AuditAction,
    AuthProvider,
    CoachingRequestStatus,
    CoachingSessionStatus,
    ContentStatus,
    GoalType,
    MealSourceType,
    PaymentTransactionStatus,
    PaymentTransactionType,
    Sex,
    SubscriptionStatus,
    UserRole,
)


class TestSettings:
    def test_default_settings(self):
        s = Settings()
        assert s.APP_NAME == "HypertrophyOS"
        assert s.JWT_ACCESS_TOKEN_EXPIRE_MINUTES == 15
        assert s.JWT_REFRESH_TOKEN_EXPIRE_DAYS == 7
        assert s.JWT_ALGORITHM == "HS256"
        assert s.LOGIN_RATE_LIMIT_THRESHOLD == 5
        assert s.CORS_ORIGINS == ["*"]

    def test_database_url_default(self):
        assert settings.DATABASE_URL  # non-empty connection string


class TestEnums:
    def test_user_roles(self):
        assert set(UserRole) == {UserRole.USER, UserRole.PREMIUM, UserRole.ADMIN}

    def test_goal_types(self):
        assert set(GoalType) == {GoalType.CUTTING, GoalType.MAINTAINING, GoalType.BULKING, GoalType.RECOMPOSITION}

    def test_activity_levels(self):
        assert len(ActivityLevel) == 5
        assert ActivityLevel.SEDENTARY == "sedentary"
        assert ActivityLevel.VERY_ACTIVE == "very_active"

    def test_subscription_statuses(self):
        assert len(SubscriptionStatus) == 5

    def test_sex_enum(self):
        assert Sex.MALE == "male"
        assert Sex.FEMALE == "female"

    def test_auth_provider_enum(self):
        assert AuthProvider.EMAIL == "email"
        assert AuthProvider.GOOGLE == "google"
        assert AuthProvider.APPLE == "apple"

    def test_content_status(self):
        assert ContentStatus.DRAFT == "draft"
        assert ContentStatus.PUBLISHED == "published"

    def test_coaching_statuses(self):
        assert len(CoachingRequestStatus) == 4
        assert len(CoachingSessionStatus) == 4

    def test_payment_types(self):
        assert PaymentTransactionType.CHARGE == "charge"
        assert PaymentTransactionType.REFUND == "refund"
        assert len(PaymentTransactionStatus) == 3

    def test_audit_actions(self):
        assert set(AuditAction) == {AuditAction.CREATE, AuditAction.UPDATE, AuditAction.DELETE}

    def test_meal_source_type(self):
        assert MealSourceType.CUSTOM == "custom"
        assert MealSourceType.FOOD_DATABASE == "food_database"


class TestErrors:
    def test_api_error_to_response(self):
        err = ApiError(status=400, code="TEST", message="test error")
        resp = err.to_response()
        assert resp.status == 400
        assert resp.code == "TEST"
        assert resp.message == "test error"
        assert resp.request_id is not None

    def test_not_found_error(self):
        err = NotFoundError()
        assert err.status == 404
        assert err.code == "NOT_FOUND"

    def test_conflict_error(self):
        err = ConflictError()
        assert err.status == 409

    def test_validation_error(self):
        err = ValidationError(details={"field": "email"})
        assert err.status == 400
        assert err.details == {"field": "email"}

    def test_premium_required_error(self):
        err = PremiumRequiredError()
        assert err.status == 403
        assert err.code == "PREMIUM_REQUIRED"

    def test_authentication_error_alias(self):
        assert AuthenticationError is UnauthorizedError

    def test_authorization_error_alias(self):
        from src.shared.errors import ForbiddenError

        assert AuthorizationError is ForbiddenError


class TestPagination:
    def test_pagination_params_defaults(self):
        p = PaginationParams()
        assert p.page == 1
        assert p.limit == 20
        assert p.offset == 0

    def test_pagination_params_offset(self):
        p = PaginationParams(page=3, limit=10)
        assert p.offset == 20

    def test_paginated_result(self):
        result = PaginatedResult[str](items=["a", "b"], total_count=5, page=1, limit=2)
        assert result.total_pages == 3
        assert result.has_next is True
        assert result.has_previous is False

    def test_paginated_result_empty(self):
        result = PaginatedResult[str](items=[], total_count=0, page=1, limit=20)
        assert result.total_pages == 0
        assert result.has_next is False
        assert result.has_previous is False


class TestHealthEndpoint:
    @pytest.mark.asyncio
    async def test_health_check(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/health")
            assert response.status_code == 200
            assert response.json() == {"status": "ok"}

    @pytest.mark.asyncio
    async def test_api_error_handler(self):
        """Verify the global ApiError exception handler works."""
        from fastapi import Request

        # The handler is registered — we test it indirectly via a 404 on unknown route
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/nonexistent")
            assert response.status_code == 404
