"""Training routes — CRUD for training sessions."""

from __future__ import annotations
from typing import List, Optional

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user, get_current_user_optional
from src.modules.auth.models import User
from src.modules.training.exercises import (
    get_all_exercises,
    get_muscle_groups,
    search_exercises,
)
from src.modules.training.day_classification import classify_day
from src.modules.training.schemas import (
    BatchPreviousPerformanceRequest,
    BatchPreviousPerformanceResponse,
    CustomExerciseCreate,
    CustomExerciseResponse,
    CustomExerciseUpdate,
    DayClassificationResponse,
    OverloadSuggestion,
    TrainingSessionCreate,
    TrainingSessionResponse,
    TrainingSessionUpdate,
    UserWorkoutTemplateResponse,
    WorkoutTemplateCreate,
    WorkoutTemplateResponse,
    WorkoutTemplateUpdate,
)
from src.modules.training.custom_exercise_service import CustomExerciseService
from src.modules.training.previous_performance import BatchPreviousPerformanceResolver, PreviousPerformanceResolver
from src.modules.training.template_service import TemplateService
from src.modules.training.analytics_service import TrainingAnalyticsService
from src.modules.training.analytics_schemas import (
    E1RMHistoryPoint,
    MuscleGroupFrequency,
    StrengthProgressionPoint,
    StrengthStandardsResponse,
    VolumeTrendPoint,
)
from src.modules.training.volume_schemas import (
    LandmarkConfigResponse,
    LandmarkUpdateRequest,
    MuscleGroupDetail,
    VolumeLandmark,
    WeeklyVolumeResponse,
)
from src.modules.training.volume_service import VolumeCalculatorService, validate_week_start
from src.modules.training.landmark_store import LandmarkStore
from src.modules.training.service import TrainingService
from src.modules.training.templates import get_template_by_id, get_templates
from src.shared.errors import NotFoundError
from src.shared.pagination import PaginatedResult, PaginationParams

router = APIRouter()


def _get_training_service(db: AsyncSession = Depends(get_db)) -> TrainingService:
    return TrainingService(db)


def _get_template_service(db: AsyncSession = Depends(get_db)) -> TemplateService:
    return TemplateService(db)


def _get_custom_exercise_service(db: AsyncSession = Depends(get_db)) -> CustomExerciseService:
    return CustomExerciseService(db)


# ─── Exercise database (public, no auth) ─────────────────────────────────────


@router.get("/exercises/muscle-groups")
async def list_muscle_groups() -> List[str]:
    """Return all available muscle group names."""
    return get_muscle_groups()


@router.get("/exercises/search")
async def search_exercises_endpoint(
    q: str = Query(default="", min_length=1),
    muscle_group: Optional[str] = Query(default=None),
    equipment: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
) -> List[dict]:
    """Search exercises by name with optional muscle group, equipment, and category filters."""
    return search_exercises(query=q, muscle_group=muscle_group, equipment=equipment, category=category)


@router.get(
    "/exercises/{exercise_name}/overload-suggestion",
    response_model=OverloadSuggestion,
    responses={204: {"description": "Insufficient data for suggestion"}},
)
async def get_overload_suggestion(
    exercise_name: str,
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


@router.get("/exercises")
async def list_exercises(
    muscle_group: Optional[str] = Query(default=None),
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    """Return all exercises, optionally filtered by muscle group.

    If the user is authenticated, their custom exercises are appended
    to the system exercise list.
    """
    exercises = list(get_all_exercises())

    # Merge custom exercises for authenticated users
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
) -> list[CustomExerciseResponse]:
    """Return all custom exercises for the authenticated user."""
    exercises = await service.list_user_custom_exercises(user.id)
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


# ─── Templates ────────────────────────────────────────────────────────────────


@router.get("/templates", response_model=List[WorkoutTemplateResponse])
async def list_templates() -> List[dict]:
    """Return all pre-built workout templates."""
    return get_templates()


@router.get("/templates/{template_id}", response_model=WorkoutTemplateResponse)
async def get_template(template_id: str) -> dict:
    """Return a single workout template by id."""
    template = get_template_by_id(template_id)
    if template is None:
        raise NotFoundError("Template not found")
    return template


# ─── User Templates (CRUD) ───────────────────────────────────────────────────


@router.post(
    "/user-templates",
    response_model=UserWorkoutTemplateResponse,
    status_code=201,
)
async def create_user_template(
    data: WorkoutTemplateCreate,
    user: User = Depends(get_current_user),
    service: TemplateService = Depends(_get_template_service),
) -> UserWorkoutTemplateResponse:
    """Create a new user workout template."""
    return await service.create_template(user_id=user.id, data=data)


@router.get(
    "/user-templates",
    response_model=List[UserWorkoutTemplateResponse],
)
async def list_user_templates(
    user: User = Depends(get_current_user),
    service: TemplateService = Depends(_get_template_service),
) -> list[UserWorkoutTemplateResponse]:
    """Return all user-created workout templates."""
    return await service.list_user_templates(user_id=user.id)


@router.put(
    "/user-templates/{template_id}",
    response_model=UserWorkoutTemplateResponse,
)
async def update_user_template(
    template_id: uuid.UUID,
    data: WorkoutTemplateUpdate,
    user: User = Depends(get_current_user),
    service: TemplateService = Depends(_get_template_service),
) -> UserWorkoutTemplateResponse:
    """Update a user workout template."""
    return await service.update_template(
        user_id=user.id, template_id=template_id, data=data
    )


@router.delete(
    "/user-templates/{template_id}",
    status_code=204,
    response_model=None,
)
async def delete_user_template(
    template_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: TemplateService = Depends(_get_template_service),
) -> None:
    """Soft-delete a user workout template."""
    await service.soft_delete_template(user_id=user.id, template_id=template_id)


@router.get("/day-classification", response_model=DayClassificationResponse)
async def get_day_classification(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    target_date: date = Query(..., alias="date"),
) -> DayClassificationResponse:
    """Classify a date as training day or rest day with muscle groups."""
    return await classify_day(db=db, user_id=user.id, target_date=target_date)


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
    return await service.create_session(user_id=user.id, data=data)


@router.get("/sessions", response_model=PaginatedResult[TrainingSessionResponse])
async def get_sessions(
    user: User = Depends(get_current_user),
    service: TrainingService = Depends(_get_training_service),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
) -> PaginatedResult[TrainingSessionResponse]:
    """Get training sessions with optional date range filter and pagination."""
    pagination = PaginationParams(page=page, limit=limit)
    return await service.get_sessions(
        user_id=user.id,
        pagination=pagination,
        start_date=start_date,
        end_date=end_date,
    )


@router.put("/sessions/{session_id}", response_model=TrainingSessionResponse)
async def update_session(
    session_id: uuid.UUID,
    data: TrainingSessionUpdate,
    user: User = Depends(get_current_user),
    service: TrainingService = Depends(_get_training_service),
) -> TrainingSessionResponse:
    """Update an existing training session."""
    return await service.update_session(
        user_id=user.id, session_id=session_id, data=data
    )


@router.delete("/sessions/{session_id}", status_code=204, response_model=None)
async def delete_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: TrainingService = Depends(_get_training_service),
) -> None:
    """Soft-delete a training session."""
    await service.soft_delete_session(user_id=user.id, session_id=session_id)


# ─── Analytics ────────────────────────────────────────────────────────────────


@router.get("/analytics/volume-trend", response_model=List[VolumeTrendPoint])
async def get_volume_trend(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    start_date: date = Query(...),
    end_date: date = Query(...),
    muscle_group: Optional[str] = Query(default=None),
) -> list[VolumeTrendPoint]:
    """Get daily training volume trend."""
    svc = TrainingAnalyticsService(db)
    return await svc.get_volume_trend(user.id, start_date, end_date, muscle_group)


@router.get("/analytics/strength-progression", response_model=List[StrengthProgressionPoint])
async def get_strength_progression(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    exercise_name: str = Query(...),
    start_date: date = Query(...),
    end_date: date = Query(...),
) -> list[StrengthProgressionPoint]:
    """Get strength progression for a specific exercise."""
    svc = TrainingAnalyticsService(db)
    return await svc.get_strength_progression(user.id, exercise_name, start_date, end_date)


@router.get("/analytics/muscle-frequency", response_model=List[MuscleGroupFrequency])
async def get_muscle_group_frequency(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    start_date: date = Query(...),
    end_date: date = Query(...),
) -> list[MuscleGroupFrequency]:
    """Get muscle group training frequency per week."""
    svc = TrainingAnalyticsService(db)
    return await svc.get_muscle_group_frequency(user.id, start_date, end_date)


@router.get("/analytics/e1rm-history", response_model=List[E1RMHistoryPoint])
async def get_e1rm_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    exercise_name: str = Query(...),
    start_date: date = Query(...),
    end_date: date = Query(...),
) -> list[E1RMHistoryPoint]:
    """Get e1RM trend for a specific exercise over a date range."""
    from fastapi import HTTPException

    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must be <= end_date")
    svc = TrainingAnalyticsService(db)
    return await svc.get_e1rm_history(user.id, exercise_name, start_date, end_date)


@router.get("/analytics/strength-standards", response_model=StrengthStandardsResponse)
async def get_strength_standards(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StrengthStandardsResponse:
    """Get strength classification and milestones for all supported lifts."""
    svc = TrainingAnalyticsService(db)
    return await svc.get_strength_standards(user.id)


# ─── Previous Performance ────────────────────────────────────────────────────


@router.get("/previous-performance")
async def get_previous_performance(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    exercise_name: str = Query(...),
) -> Optional[dict]:
    """Get previous performance for a specific exercise."""
    resolver = PreviousPerformanceResolver(db)
    result = await resolver.get_previous_performance(user.id, exercise_name)
    if result is None:
        return None
    return {
        "exercise_name": result.exercise_name,
        "session_date": str(result.session_date),
        "last_set_weight_kg": result.last_set_weight_kg,
        "last_set_reps": result.last_set_reps,
    }


@router.post(
    "/previous-performance/batch",
    response_model=BatchPreviousPerformanceResponse,
)
async def get_batch_previous_performance(
    data: BatchPreviousPerformanceRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BatchPreviousPerformanceResponse:
    """Get previous performance for multiple exercises in a single request."""
    resolver = BatchPreviousPerformanceResolver(db)
    results = await resolver.get_batch_previous_performance(user.id, data.exercise_names)
    return BatchPreviousPerformanceResponse(results=results)


# ─── Muscle Volume Heat Map ──────────────────────────────────────────────────


def _default_week_start() -> date:
    """Return the Monday of the current ISO week."""
    today = date.today()
    return today - __import__("datetime").timedelta(days=today.weekday())


@router.get("/analytics/muscle-volume", response_model=WeeklyVolumeResponse)
async def get_muscle_volume(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    week_start: Optional[date] = Query(default=None),
) -> WeeklyVolumeResponse:
    """Get weekly muscle group volume with landmark comparisons."""
    from datetime import timedelta

    if week_start is None:
        week_start = _default_week_start()
    else:
        try:
            validate_week_start(week_start)
        except ValueError:
            from src.shared.errors import UnprocessableError
            raise UnprocessableError("week_start must be a Monday date")

    svc = VolumeCalculatorService(db)
    muscle_groups = await svc.get_weekly_muscle_volume(user.id, week_start)
    return WeeklyVolumeResponse(
        week_start=week_start,
        week_end=week_start + timedelta(days=6),
        muscle_groups=muscle_groups,
    )


@router.get(
    "/analytics/muscle-volume/{muscle_group}/detail",
    response_model=MuscleGroupDetail,
)
async def get_muscle_volume_detail(
    muscle_group: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    week_start: Optional[date] = Query(default=None),
) -> MuscleGroupDetail:
    """Get per-exercise volume breakdown for a muscle group."""
    if week_start is None:
        week_start = _default_week_start()
    else:
        try:
            validate_week_start(week_start)
        except ValueError:
            from src.shared.errors import UnprocessableError
            raise UnprocessableError("week_start must be a Monday date")

    svc = VolumeCalculatorService(db)
    return await svc.get_muscle_group_detail(user.id, muscle_group, week_start)


@router.get("/analytics/volume-landmarks", response_model=LandmarkConfigResponse)
async def get_volume_landmarks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LandmarkConfigResponse:
    """Get merged volume landmarks (defaults + user customizations)."""
    store = LandmarkStore(db)
    landmarks = await store.get_landmarks(user.id)
    return LandmarkConfigResponse(landmarks=list(landmarks.values()))


@router.put("/analytics/volume-landmarks", response_model=VolumeLandmark)
async def set_volume_landmark(
    data: LandmarkUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VolumeLandmark:
    """Set custom volume landmarks for a muscle group."""
    store = LandmarkStore(db)
    return await store.set_landmark(user.id, data.muscle_group, data.mev, data.mav, data.mrv)


@router.delete(
    "/analytics/volume-landmarks/{muscle_group}",
    status_code=204,
    response_model=None,
)
async def delete_volume_landmark(
    muscle_group: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete custom landmarks for a muscle group, reverting to defaults."""
    store = LandmarkStore(db)
    await store.delete_landmark(user.id, muscle_group)
