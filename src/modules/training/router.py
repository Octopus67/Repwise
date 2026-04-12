"""Training routes — CRUD for sessions, exercises, and custom exercises."""

from __future__ import annotations
from typing import List, Optional

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Path, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user, get_current_user_optional
from src.middleware.rate_limiter import check_ip_endpoint_rate_limit, check_user_endpoint_rate_limit
from src.modules.auth.models import User
from src.shared.ip_utils import get_client_ip
from src.modules.training.exercises import (
    find_substitutes,
    get_all_exercises,
    get_muscle_groups,
    search_exercises,
)
from src.modules.training.day_classification import classify_day
from src.modules.training.schemas import (
    BatchOverloadRequest,
    BatchOverloadResponse,
    CustomExerciseCreate,
    CustomExerciseResponse,
    CustomExerciseUpdate,
    DayClassificationResponse,
    OverloadSuggestion,
    TrainingSessionCreate,
    TrainingSessionResponse,
    TrainingSessionUpdate,
)
from src.modules.training.custom_exercise_service import CustomExerciseService
from src.modules.training.service import TrainingService
from src.shared.pagination import PaginationParams

router = APIRouter()


def _get_training_service(db: AsyncSession = Depends(get_db)) -> TrainingService:
    return TrainingService(db)


def _get_custom_exercise_service(db: AsyncSession = Depends(get_db)) -> CustomExerciseService:
    return CustomExerciseService(db)


# ─── Exercise database (public, no auth) ─────────────────────────────────────


@router.get("/exercises/muscle-groups")
async def list_muscle_groups() -> List[str]:
    """Return all available muscle group names."""
    return get_muscle_groups()


@router.get("/exercises/search")
async def search_exercises_endpoint(
    request: Request,  # Audit fix 10.4 — IP-based rate limit: 60 req/min
    response: Response,
    q: str = Query(default="", max_length=200),
    muscle_group: Optional[str] = Query(default=None, max_length=100),
    equipment: Optional[str] = Query(default=None, max_length=100),
    category: Optional[str] = Query(default=None, max_length=100),
) -> List[dict]:
    """Search exercises by name with optional muscle group, equipment, and category filters."""
    await check_ip_endpoint_rate_limit(
        get_client_ip(request), "exercise_search", 60, 60
    )  # Audit fix 10.4
    response.headers["Cache-Control"] = "public, max-age=300"
    return search_exercises(
        query=q, muscle_group=muscle_group, equipment=equipment, category=category
    )


@router.get("/exercises/{identifier}/substitutes")
async def get_exercise_substitutes(
    identifier: str,
    equipment: str | None = Query(None, description="Comma-separated equipment filter"),
    limit: int = Query(5, ge=1, le=20),
):
    """Find biomechanics-similar substitute exercises."""
    available_equipment = equipment.split(",") if equipment else None
    results = find_substitutes(identifier, available_equipment, limit)
    # Remove internal scoring field
    return [{k: v for k, v in r.items() if k != "_similarity_score"} for r in results]


@router.get(
    "/exercises/{exercise_name}/overload-suggestion",
    response_model=OverloadSuggestion,
    responses={204: {"description": "Insufficient data for suggestion"}},
)
async def get_overload_suggestion(
    exercise_name: str = Path(..., max_length=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OverloadSuggestion:
    """Return a progressive overload suggestion for the given exercise."""
    from src.modules.training.overload_service import OverloadSuggestionService

    svc = OverloadSuggestionService(db)
    suggestion = await svc.get_suggestion(user.id, exercise_name)
    if suggestion is None:
        return Response(status_code=204)
    return suggestion


@router.post(
    "/exercises/batch-overload-suggestions",
    response_model=BatchOverloadResponse,
)
async def get_batch_overload_suggestions(
    request: BatchOverloadRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BatchOverloadResponse:
    """Return progressive overload suggestions for multiple exercises at once."""
    from src.modules.training.overload_service import OverloadSuggestionService

    svc = OverloadSuggestionService(db)
    suggestions = await svc.get_batch_suggestions(user.id, request.exercise_names)
    return BatchOverloadResponse(suggestions=suggestions)


@router.get("/exercises")
async def list_exercises(
    muscle_group: Optional[str] = Query(default=None, max_length=100),
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    """Return all exercises, optionally filtered by muscle group.

    If the user is authenticated, their custom exercises are appended
    to the system exercise list.
    """
    exercises = list(get_all_exercises())

    if user is not None:
        custom_svc = CustomExerciseService(db)
        custom_dicts = await custom_svc.list_user_custom_exercises_as_dicts(user.id)
        exercises.extend(custom_dicts)

    if muscle_group:
        mg = muscle_group.lower()
        exercises = [ex for ex in exercises if ex["muscle_group"] == mg]
    return exercises


# ─── Custom Exercises (CRUD, auth required) ──────────────────────────────────


@router.post(
    "/exercises/custom",
    response_model=CustomExerciseResponse,
    status_code=201,
)
async def create_custom_exercise(
    data: CustomExerciseCreate,
    user: User = Depends(get_current_user),
    service: CustomExerciseService = Depends(_get_custom_exercise_service),
) -> CustomExerciseResponse:
    """Create a new user custom exercise."""
    exercise = await service.create_custom_exercise(
        user_id=user.id,
        name=data.name,
        muscle_group=data.muscle_group,
        equipment=data.equipment,
        category=data.category,
        secondary_muscles=data.secondary_muscles,
        notes=data.notes,
    )
    return CustomExerciseResponse.from_orm_model(exercise)


@router.get(
    "/exercises/custom",
    response_model=List[CustomExerciseResponse],
)
async def list_custom_exercises(
    user: User = Depends(get_current_user),
    service: CustomExerciseService = Depends(_get_custom_exercise_service),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[CustomExerciseResponse]:
    """Return all custom exercises for the authenticated user."""
    exercises = await service.list_user_custom_exercises(user.id, limit=limit, offset=offset)
    return [CustomExerciseResponse.from_orm_model(ex) for ex in exercises]


@router.put(
    "/exercises/custom/{exercise_id}",
    response_model=CustomExerciseResponse,
)
async def update_custom_exercise(
    exercise_id: uuid.UUID,
    data: CustomExerciseUpdate,
    user: User = Depends(get_current_user),
    service: CustomExerciseService = Depends(_get_custom_exercise_service),
) -> CustomExerciseResponse:
    """Update a user custom exercise."""
    exercise = await service.update_custom_exercise(
        user_id=user.id,
        exercise_id=exercise_id,
        name=data.name,
        muscle_group=data.muscle_group,
        equipment=data.equipment,
        category=data.category,
        secondary_muscles=data.secondary_muscles,
        notes=data.notes,
    )
    return CustomExerciseResponse.from_orm_model(exercise)


@router.delete(
    "/exercises/custom/{exercise_id}",
    status_code=204,
    response_model=None,
)
async def delete_custom_exercise(
    exercise_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: CustomExerciseService = Depends(_get_custom_exercise_service),
) -> None:
    """Soft-delete a user custom exercise."""
    await service.delete_custom_exercise(user_id=user.id, exercise_id=exercise_id)


# ─── Day Classification ──────────────────────────────────────────────────────


@router.get("/day-classification", response_model=DayClassificationResponse)
async def get_day_classification(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    target_date: date = Query(..., alias="date"),
) -> DayClassificationResponse:
    """Classify a date as training day or rest day with muscle groups."""
    return await classify_day(db=db, user_id=user.id, target_date=target_date)


# ─── Training Sessions (CRUD) ────────────────────────────────────────────────


@router.get("/sessions/{session_id}", response_model=TrainingSessionResponse)
async def get_session_by_id(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: TrainingService = Depends(_get_training_service),
) -> TrainingSessionResponse:
    """Return a single training session by ID."""
    return await service.get_session_by_id(user_id=user.id, session_id=session_id)


@router.post("/sessions", response_model=TrainingSessionResponse, status_code=201)
async def create_session(
    data: TrainingSessionCreate,
    user: User = Depends(get_current_user),
    service: TrainingService = Depends(_get_training_service),
) -> TrainingSessionResponse:
    """Create a new training session."""
    await check_user_endpoint_rate_limit(str(user.id), "training_create", 60, 60)
    return await service.create_session(user_id=user.id, data=data)


@router.get("/sessions")
async def get_sessions(
    user: User = Depends(get_current_user),
    service: TrainingService = Depends(_get_training_service),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    lightweight: bool = Query(
        default=False, description="Return summary without full exercises JSONB"
    ),
):
    """Get training sessions with optional date range filter and pagination.

    Pass lightweight=true to omit full exercises JSONB (returns exercise_count, total_sets, muscle_groups instead).
    Use GET /sessions/{session_id} for full exercise data.
    """
    pagination = PaginationParams(page=page, limit=limit)
    return await service.get_sessions(
        user_id=user.id,
        pagination=pagination,
        start_date=start_date,
        end_date=end_date,
        lightweight=lightweight,
    )


@router.put("/sessions/{session_id}", response_model=TrainingSessionResponse)
async def update_session(
    session_id: uuid.UUID,
    data: TrainingSessionUpdate,
    user: User = Depends(get_current_user),
    service: TrainingService = Depends(_get_training_service),
) -> TrainingSessionResponse:
    """Update an existing training session."""
    await check_user_endpoint_rate_limit(str(user.id), "training_update", 60, 60)
    return await service.update_session(user_id=user.id, session_id=session_id, data=data)


@router.delete("/sessions/{session_id}", status_code=204, response_model=None)
async def delete_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: TrainingService = Depends(_get_training_service),
) -> None:
    """Soft-delete a training session."""
    await service.soft_delete_session(user_id=user.id, session_id=session_id)
