"""FastAPI application entry point."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError as PydanticValidationError

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sqlalchemy.exc import SQLAlchemyError

from src.config.settings import settings
from src.config.logging_config import configure_logging
from src.middleware.logging_middleware import StructuredLoggingMiddleware
from src.middleware.global_rate_limiter import GlobalRateLimitMiddleware
from src.middleware.body_size_limit import BodySizeLimitMiddleware
from src.middleware.request_timeout import RequestTimeoutMiddleware
from src.middleware.validate import (
    pydantic_validation_exception_handler,
    validation_exception_handler,
)
from src.shared.errors import ApiError
from src.shared.security_logger import log_api_error
from src.shared.ip_utils import get_client_ip

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Create tables on startup when using SQLite (local dev mode)."""
    configure_logging(debug=settings.DEBUG)
    if "sqlite" in settings.DATABASE_URL:
        from sqlalchemy import JSON, text
        from sqlalchemy.dialects.postgresql import JSONB
        from src.shared.base_model import Base
        from src.config.database import engine

        # Import all models so Base.metadata knows about every table
        import src.modules.auth.models  # noqa: F401
        import src.modules.user.models  # noqa: F401
        import src.modules.adaptive.models  # noqa: F401
        import src.modules.nutrition.models  # noqa: F401
        import src.modules.meals.models  # noqa: F401
        import src.modules.training.models  # noqa: F401
        import src.modules.payments.models  # noqa: F401
        import src.modules.content.models  # noqa: F401
        import src.modules.coaching.models  # noqa: F401
        import src.modules.food_database.models  # noqa: F401
        import src.modules.feature_flags.models  # noqa: F401

        import src.modules.founder.models  # noqa: F401
        import src.modules.progress_photos.models  # noqa: F401
        import src.modules.achievements.models  # noqa: F401
        import src.modules.periodization.models  # noqa: F401
        import src.modules.training.volume_models  # noqa: F401
        import src.modules.readiness.readiness_models  # noqa: F401
        import src.modules.recomp.models  # noqa: F401
        import src.modules.meal_plans.models  # noqa: F401
        import src.modules.notifications.models  # noqa: F401
        import src.modules.measurements.models  # noqa: F401
        import src.modules.sharing.models  # noqa: F401
        import src.modules.export.models  # noqa: F401
        import src.modules.challenges.models  # noqa: F401
        import src.modules.health_reports.models  # noqa: F401
        import src.modules.social.models  # noqa: F401
        import src.shared.audit  # noqa: F401
        import src.middleware.rate_limit_models  # noqa: F401

        # Patch JSONB → JSON for SQLite compatibility
        for table in Base.metadata.tables.values():
            for column in table.columns:
                if isinstance(column.type, JSONB):
                    column.type = JSON()
                if column.server_default is not None:
                    default_text = str(column.server_default.arg) if hasattr(column.server_default, "arg") else ""
                    if "::jsonb" in default_text or "gen_random_uuid" in default_text:
                        column.server_default = None

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

            # Patch existing tables with new columns (create_all doesn't ALTER existing tables)
            for alter_sql in [
                "ALTER TABLE content_articles ADD COLUMN unlocked_by_achievement VARCHAR(100)",
                "ALTER TABLE user_food_frequency ADD COLUMN is_favorite BOOLEAN DEFAULT 0",
                "ALTER TABLE training_sessions ADD COLUMN personal_records_json TEXT",
                "ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP",
                "ALTER TABLE export_requests ADD COLUMN retry_count INTEGER DEFAULT 0",
                "CREATE INDEX IF NOT EXISTS ix_share_events_session_id ON share_events (session_id)",
            ]:
                try:
                    await conn.execute(text(alter_sql))
                except (SQLAlchemyError, OSError):
                    pass  # Intentional: column already exists

        logger.info("SQLite tables created for local dev")

        # Seed food database if empty
        from src.config.database import async_session_factory
        from src.modules.food_database.models import FoodItem
        from src.modules.food_database.seed_data import INDIAN_FOOD_ITEMS
        from sqlalchemy import select, func

        from src.modules.food_database.global_seed_data import GLOBAL_FOOD_ITEMS

        async with async_session_factory() as session:
            count = (await session.execute(select(func.count()).select_from(FoodItem))).scalar_one()
            if count == 0:
                for item_data in INDIAN_FOOD_ITEMS:
                    item = FoodItem(
                        name=item_data["name"],
                        category=item_data.get("category", "General"),
                        region=item_data.get("region", "Indian"),
                        serving_size=item_data.get("serving_size", 100.0),
                        serving_unit=item_data.get("serving_unit", "g"),
                        calories=item_data["calories"],
                        protein_g=item_data["protein_g"],
                        carbs_g=item_data["carbs_g"],
                        fat_g=item_data["fat_g"],
                        micro_nutrients=item_data.get("micro_nutrients"),
                        source="verified",
                    )
                    session.add(item)
                await session.commit()
                logger.info("Seeded %d Indian food items", len(INDIAN_FOOD_ITEMS))
            else:
                logger.info("Food database already has %d items, skipping seed", count)

            # Seed global food items if only Indian foods are present
            count = (await session.execute(select(func.count()).select_from(FoodItem))).scalar_one()
            if count < 200:
                for item_data in GLOBAL_FOOD_ITEMS:
                    item = FoodItem(
                        name=item_data["name"],
                        category=item_data.get("category", "General"),
                        region=item_data.get("region", "Global"),
                        serving_size=item_data.get("serving_size", 100.0),
                        serving_unit=item_data.get("serving_unit", "g"),
                        calories=item_data["calories"],
                        protein_g=item_data["protein_g"],
                        carbs_g=item_data["carbs_g"],
                        fat_g=item_data["fat_g"],
                        micro_nutrients=item_data.get("micro_nutrients"),
                        source=item_data.get("source", "usda"),
                    )
                    session.add(item)
                await session.commit()
                logger.info("Seeded %d global food items", len(GLOBAL_FOOD_ITEMS))

        # Seed social bot accounts and starter content
        from src.modules.social.seed import seed_social_data
        async with async_session_factory() as session:
            try:
                await seed_social_data(session)
            except (SQLAlchemyError, OSError, ValueError):
                logger.exception("Failed to seed social data")

    # Cleanup expired rate limit entries on startup (all backends)
    from src.middleware.db_rate_limiter import cleanup_expired_entries
    from src.config.database import async_session_factory as _session_factory
    async with _session_factory() as session:
        deleted = await cleanup_expired_entries(session)
        if deleted:
            logger.info("Cleaned up %d expired rate limit entries", deleted)

    # Scheduler: only one Gunicorn worker becomes the leader via Redis lock
    from src.config.scheduler import try_acquire_lock, start_scheduler, stop_scheduler
    _is_scheduler_leader = try_acquire_lock()
    if _is_scheduler_leader:
        await start_scheduler()

    yield

    # Graceful shutdown: stop scheduler before closing Redis
    if _is_scheduler_leader:
        await stop_scheduler()

    # Shutdown: close Redis connection
    from src.config.redis import close_redis
    close_redis()


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    # Audit fix 6.11 — docs independent of DEBUG
    docs_url="/api/v1/docs" if settings.ENABLE_DOCS else None,
    openapi_url="/api/v1/openapi.json" if settings.ENABLE_DOCS else None,
    lifespan=lifespan,
)

# Sentry — conditional on SENTRY_DSN being set
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        # Audit fix 7.8 — higher trace rate for launch
        # TODO: Reduce to 0.1 after launch stabilization (2 weeks)
        traces_sample_rate=float(os.getenv('SENTRY_TRACES_SAMPLE_RATE', '0.5')),
        environment="production" if not settings.DEBUG else "development",
    )

# Middleware stack (Starlette executes in reverse add order — last added = outermost)
app.add_middleware(GlobalRateLimitMiddleware, rpm=settings.RATE_LIMIT_RPM)
app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(StructuredLoggingMiddleware)
app.add_middleware(RequestTimeoutMiddleware)

# HTTPS enforcement in production
if not settings.DEBUG:
    from src.middleware.https_redirect import HTTPSRedirectMiddleware
    app.add_middleware(HTTPSRedirectMiddleware)

# CORS
# Audit fix 10.8 — reject wildcard origin when credentials are enabled
if "*" in settings.cors_origins_list:
    raise RuntimeError("CORS: wildcard '*' origin is not allowed when allow_credentials=True")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Security headers on every response
from src.middleware.security_headers import SecurityHeadersMiddleware
app.add_middleware(SecurityHeadersMiddleware)

# Note: TrustedHostMiddleware removed — Railway's reverse proxy handles host
# validation, and CORS middleware handles origin validation. The middleware
# was blocking Railway's internal health checker which uses a different hostname.


# Global exception handler for ApiError
@app.exception_handler(ApiError)
async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    headers = {}
    if exc.status == 429 and hasattr(exc, "retry_after"):
        headers["Retry-After"] = str(exc.retry_after)
    return JSONResponse(
        status_code=exc.status,
        content=exc.to_response().model_dump(),
        headers=headers or None,
    )


# Global exception handler for request validation errors (Requirement 20.4)
app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(PydanticValidationError, pydantic_validation_exception_handler)  # type: ignore[arg-type]


# Catch-all for unhandled exceptions — ensures CORS headers are attached to 500 responses
@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    import logging
    import uuid as _uuid
    request_id = str(_uuid.uuid4())
    logging.getLogger(__name__).exception("Unhandled exception [%s]: %s", request_id, exc)
    log_api_error(
        path=str(_request.url.path),
        status=500,
        error=str(exc),
        ip=get_client_ip(_request),
    )
    user_id = getattr(_request.state, "user_id", None)
    if user_id:
        sentry_sdk.set_user({"id": str(user_id)})
    sentry_sdk.capture_exception(exc)
    return JSONResponse(
        status_code=500,
        content={"status": 500, "code": "INTERNAL_ERROR", "message": "An unexpected error occurred", "details": None, "request_id": request_id},
    )


# Health check
@app.get("/api/v1/health")
async def health_check() -> JSONResponse:
    from sqlalchemy import text
    from src.config.database import async_session_factory

    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        return JSONResponse(status_code=200, content={"status": "ok"})
    except (SQLAlchemyError, OSError):
        logger.exception("Health check DB ping failed")
        return JSONResponse(status_code=503, content={"status": "unhealthy", "reason": "database unreachable"})


# Jobs health — returns next-run timestamps for all scheduled jobs
# Restricted to debug mode: exposes scheduler internals (job names, schedules)
if settings.DEBUG:
    @app.get("/api/v1/health/jobs")
    async def jobs_health() -> JSONResponse:
        from src.config.scheduler import scheduler
        jobs = {}
        for job in scheduler.get_jobs():
            jobs[job.id] = {
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            }
        return JSONResponse(status_code=200, content={
            "scheduler_running": scheduler.running,
            "jobs": jobs,
        })

# Serve exercise images from local static directory
_static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.isdir(_static_dir):
    app.mount("/static", StaticFiles(directory=_static_dir), name="static")

# Router registration
from src.modules.auth.router import router as auth_router
from src.modules.user.router import router as user_router
from src.modules.nutrition.router import router as nutrition_router
from src.modules.training.router import router as training_router
from src.modules.meals.router import router as meals_router

app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(user_router, prefix="/api/v1/users", tags=["users"])
app.include_router(nutrition_router, prefix="/api/v1/nutrition", tags=["nutrition"])
app.include_router(training_router, prefix="/api/v1/training", tags=["training"])
app.include_router(meals_router, prefix="/api/v1/meals", tags=["meals"])

from src.modules.adaptive.router import router as adaptive_router
app.include_router(adaptive_router, prefix="/api/v1/adaptive", tags=["adaptive"])

from src.modules.payments.router import router as payments_router
app.include_router(payments_router, prefix="/api/v1/payments", tags=["payments"])

from src.modules.payments.trial_router import router as trial_router
app.include_router(trial_router, prefix="/api/v1/trial", tags=["trial"])

from src.modules.content.router import router as content_router
app.include_router(content_router, prefix="/api/v1/content", tags=["content"])

from src.modules.coaching.router import router as coaching_router
app.include_router(coaching_router, prefix="/api/v1/coaching", tags=["coaching"])

from src.modules.food_database.router import router as food_router
app.include_router(food_router, prefix="/api/v1/food", tags=["food"])



from src.modules.dietary_analysis.router import router as dietary_router
app.include_router(dietary_router, prefix="/api/v1/dietary", tags=["dietary"])

from src.modules.founder.router import router as founder_router
app.include_router(founder_router, prefix="/api/v1/founder", tags=["founder"])

from src.modules.community.router import router as community_router
app.include_router(community_router, prefix="/api/v1/community", tags=["community"])

from src.modules.account.router import router as account_router
app.include_router(account_router, prefix="/api/v1/account", tags=["account"])

from src.modules.onboarding.router import router as onboarding_router
app.include_router(onboarding_router, prefix="/api/v1/onboarding", tags=["onboarding"])

from src.modules.dashboard.router import router as dashboard_router
app.include_router(dashboard_router, prefix="/api/v1", tags=["dashboard"])

from src.modules.training.analytics_router import router as analytics_router
app.include_router(analytics_router, prefix="/api/v1/training", tags=["training-analytics"])

from src.modules.training.volume_router import router as volume_router
app.include_router(volume_router, prefix="/api/v1/training", tags=["training-volume"])

from src.modules.training.templates_router import router as templates_router
app.include_router(templates_router, prefix="/api/v1/training", tags=["training-templates"])

from src.modules.training.fatigue_router import router as fatigue_router
app.include_router(fatigue_router, prefix="/api/v1/training", tags=["training-fatigue"])

from src.modules.progress_photos.router import router as progress_photos_router
app.include_router(progress_photos_router, prefix="/api/v1/progress-photos", tags=["progress-photos"])

from src.modules.achievements.router import router as achievements_router
app.include_router(achievements_router, prefix="/api/v1/achievements", tags=["achievements"])

from src.modules.periodization.router import router as periodization_router
app.include_router(periodization_router, prefix="/api/v1/periodization", tags=["periodization"])

from src.modules.readiness.readiness_router import router as readiness_router
app.include_router(readiness_router, prefix="/api/v1/readiness", tags=["readiness"])

from src.modules.reports.router import router as reports_router
app.include_router(reports_router, prefix="/api/v1/reports", tags=["reports"])

from src.modules.recomp.router import router as recomp_router
app.include_router(recomp_router, prefix="/api/v1/recomp", tags=["recomp"])

from src.modules.meal_plans.router import router as meal_plans_router
app.include_router(meal_plans_router, prefix="/api/v1/meal-plans", tags=["meal-plans"])

from src.modules.notifications.router import router as notifications_router
app.include_router(notifications_router, prefix="/api/v1/notifications", tags=["notifications"])

from src.modules.feature_flags.router import router as feature_flags_router
app.include_router(feature_flags_router, prefix="/api/v1/feature-flags", tags=["feature-flags"])

from src.modules.measurements.router import router as measurements_router
app.include_router(measurements_router, prefix="/api/v1/body-measurements", tags=["body-measurements"])

from src.modules.sharing.router import router as sharing_router
app.include_router(sharing_router, prefix="/api/v1/share", tags=["sharing"])

from src.modules.export.router import router as export_router
app.include_router(export_router, prefix="/api/v1/export", tags=["export"])

from src.modules.challenges.router import router as challenges_router
app.include_router(challenges_router, prefix="/api/v1", tags=["challenges"])

from src.modules.health_reports.router import router as health_reports_router
app.include_router(health_reports_router, prefix="/api/v1/health-reports", tags=["health-reports"])

from src.modules.social.router import router as social_router
app.include_router(social_router, prefix="/api/v1/social", tags=["social"])

from src.modules.import_data.router import router as import_router
app.include_router(import_router, prefix="/api/v1/import", tags=["import"])

from src.modules.legal.router import router as legal_router
app.include_router(legal_router)  # Root level — /privacy and /terms
