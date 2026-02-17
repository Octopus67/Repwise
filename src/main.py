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

from src.config.settings import settings
from src.middleware.validate import (
    pydantic_validation_exception_handler,
    validation_exception_handler,
)
from src.shared.errors import ApiError

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Create tables on startup when using SQLite (local dev mode)."""
    if "sqlite" in settings.DATABASE_URL:
        from sqlalchemy import JSON
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
        import src.modules.health_reports.models  # noqa: F401
        import src.modules.founder.models  # noqa: F401
        import src.modules.progress_photos.models  # noqa: F401
        import src.modules.achievements.models  # noqa: F401
        import src.modules.periodization.models  # noqa: F401
        import src.modules.training.volume_models  # noqa: F401
        import src.modules.readiness.readiness_models  # noqa: F401
        import src.modules.recomp.models  # noqa: F401
        import src.modules.meal_plans.models  # noqa: F401
        import src.shared.audit  # noqa: F401

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

    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    docs_url="/api/v1/docs",
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler for ApiError
@app.exception_handler(ApiError)
async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content=exc.to_response().model_dump(),
    )


# Global exception handler for request validation errors (Requirement 20.4)
app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(PydanticValidationError, pydantic_validation_exception_handler)  # type: ignore[arg-type]


# Health check
@app.get("/api/v1/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}

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

from src.modules.content.router import router as content_router
app.include_router(content_router, prefix="/api/v1/content", tags=["content"])

from src.modules.coaching.router import router as coaching_router
app.include_router(coaching_router, prefix="/api/v1/coaching", tags=["coaching"])

from src.modules.food_database.router import router as food_router
app.include_router(food_router, prefix="/api/v1/food", tags=["food"])

from src.modules.health_reports.router import router as health_router
app.include_router(health_router, prefix="/api/v1/health", tags=["health"])

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

from src.modules.training.analytics_router import router as analytics_router
app.include_router(analytics_router, prefix="/api/v1/training", tags=["training-analytics"])

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
