"""Unit tests for the user module — task 4.1.

Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
"""

import uuid
from datetime import date, datetime

import pytest

from src.modules.user.models import BodyweightLog, UserGoal, UserMetric, UserProfile
from src.modules.user.schemas import (
    BodyweightLogCreate,
    UserGoalSet,
    UserMetricCreate,
    UserProfileUpdate,
)
from src.modules.user.service import UserService
from src.shared.pagination import PaginationParams
from src.shared.types import ActivityLevel, GoalType


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _user_id() -> uuid.UUID:
    return uuid.uuid4()


# ------------------------------------------------------------------
# Profile tests (Requirement 2.1)
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_profile_creates_blank_when_missing(db_session):
    """get_profile auto-creates a blank profile for a new user."""
    svc = UserService(db_session)
    uid = _user_id()
    profile = await svc.get_profile(uid)
    assert profile.user_id == uid
    assert profile.display_name is None


@pytest.mark.asyncio
async def test_update_profile_persists_changes(db_session):
    """update_profile stores and returns updated fields."""
    svc = UserService(db_session)
    uid = _user_id()

    updated = await svc.update_profile(
        uid,
        UserProfileUpdate(display_name="Lifter", timezone="Asia/Kolkata", region="IN"),
    )
    assert updated.display_name == "Lifter"
    assert updated.timezone == "Asia/Kolkata"
    assert updated.region == "IN"

    # Re-read to confirm persistence
    fetched = await svc.get_profile(uid)
    assert fetched.display_name == "Lifter"


@pytest.mark.asyncio
async def test_update_profile_partial_update(db_session):
    """Only supplied fields are changed; others remain untouched."""
    svc = UserService(db_session)
    uid = _user_id()

    await svc.update_profile(uid, UserProfileUpdate(display_name="A", region="US"))
    updated = await svc.update_profile(uid, UserProfileUpdate(display_name="B"))

    assert updated.display_name == "B"
    assert updated.region == "US"  # unchanged


# ------------------------------------------------------------------
# Metrics tests (Requirements 2.2, 2.5)
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_log_metrics_appends_entry(db_session):
    """log_metrics creates a new row and returns it."""
    svc = UserService(db_session)
    uid = _user_id()

    result = await svc.log_metrics(
        uid,
        UserMetricCreate(height_cm=180.0, weight_kg=85.0, body_fat_pct=15.0, activity_level=ActivityLevel.ACTIVE),
    )
    assert result.user_id == uid
    assert result.height_cm == 180.0
    assert result.weight_kg == 85.0
    assert result.activity_level == "active"


@pytest.mark.asyncio
async def test_metrics_history_is_append_only(db_session):
    """Multiple log_metrics calls produce independent rows (Req 2.5)."""
    svc = UserService(db_session)
    uid = _user_id()

    await svc.log_metrics(uid, UserMetricCreate(weight_kg=80.0))
    await svc.log_metrics(uid, UserMetricCreate(weight_kg=81.0))
    await svc.log_metrics(uid, UserMetricCreate(weight_kg=82.0))

    history = await svc.get_metrics_history(uid, PaginationParams(page=1, limit=10))
    assert history.total_count == 3
    weights = [m.weight_kg for m in history.items]
    assert 80.0 in weights
    assert 81.0 in weights
    assert 82.0 in weights


@pytest.mark.asyncio
async def test_metrics_history_pagination(db_session):
    """Pagination returns correct slices and metadata."""
    svc = UserService(db_session)
    uid = _user_id()

    for i in range(5):
        await svc.log_metrics(uid, UserMetricCreate(weight_kg=70.0 + i))

    page1 = await svc.get_metrics_history(uid, PaginationParams(page=1, limit=2))
    assert len(page1.items) == 2
    assert page1.total_count == 5
    assert page1.page == 1
    assert page1.has_next is True

    page3 = await svc.get_metrics_history(uid, PaginationParams(page=3, limit=2))
    assert len(page3.items) == 1
    assert page3.has_next is False


# ------------------------------------------------------------------
# Bodyweight log tests (Requirements 2.3, 2.5)
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_log_bodyweight_creates_entry(db_session):
    """log_bodyweight persists a new entry."""
    svc = UserService(db_session)
    uid = _user_id()

    result = await svc.log_bodyweight(uid, BodyweightLogCreate(weight_kg=83.5, recorded_date=date(2025, 1, 15)))
    assert result.user_id == uid
    assert result.weight_kg == 83.5
    assert result.recorded_date == date(2025, 1, 15)


@pytest.mark.asyncio
async def test_bodyweight_history_append_only(db_session):
    """Multiple entries are all retained (Req 2.5)."""
    svc = UserService(db_session)
    uid = _user_id()

    await svc.log_bodyweight(uid, BodyweightLogCreate(weight_kg=80.0, recorded_date=date(2025, 1, 1)))
    await svc.log_bodyweight(uid, BodyweightLogCreate(weight_kg=80.5, recorded_date=date(2025, 1, 2)))

    history = await svc.get_bodyweight_history(uid, PaginationParams(page=1, limit=10))
    assert history.total_count == 2


@pytest.mark.asyncio
async def test_bodyweight_history_pagination(db_session):
    """Pagination works for bodyweight history."""
    svc = UserService(db_session)
    uid = _user_id()

    for i in range(4):
        await svc.log_bodyweight(uid, BodyweightLogCreate(weight_kg=80.0 + i, recorded_date=date(2025, 1, i + 1)))

    page1 = await svc.get_bodyweight_history(uid, PaginationParams(page=1, limit=2))
    assert len(page1.items) == 2
    assert page1.total_count == 4

    page2 = await svc.get_bodyweight_history(uid, PaginationParams(page=2, limit=2))
    assert len(page2.items) == 2


# ------------------------------------------------------------------
# Goals tests (Requirement 2.4)
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_set_goals_creates_new(db_session):
    """set_goals creates a goal record when none exists."""
    svc = UserService(db_session)
    uid = _user_id()

    result = await svc.set_goals(uid, UserGoalSet(goal_type=GoalType.CUTTING, target_weight_kg=75.0, goal_rate_per_week=-0.5))
    assert result.user_id == uid
    assert result.goal_type == "cutting"
    assert result.target_weight_kg == 75.0
    assert result.goal_rate_per_week == -0.5


@pytest.mark.asyncio
async def test_set_goals_updates_existing(db_session):
    """set_goals upserts — second call updates the same row."""
    svc = UserService(db_session)
    uid = _user_id()

    await svc.set_goals(uid, UserGoalSet(goal_type=GoalType.CUTTING, target_weight_kg=75.0))
    updated = await svc.set_goals(uid, UserGoalSet(goal_type=GoalType.BULKING, target_weight_kg=90.0))

    assert updated.goal_type == "bulking"
    assert updated.target_weight_kg == 90.0


@pytest.mark.asyncio
async def test_get_goals_returns_none_when_unset(db_session):
    """get_goals returns None for a user with no goals."""
    svc = UserService(db_session)
    result = await svc.get_goals(_user_id())
    assert result is None


@pytest.mark.asyncio
async def test_get_goals_returns_current(db_session):
    """get_goals returns the most recently set goals."""
    svc = UserService(db_session)
    uid = _user_id()

    await svc.set_goals(uid, UserGoalSet(goal_type=GoalType.MAINTAINING))
    result = await svc.get_goals(uid)
    assert result is not None
    assert result.goal_type == "maintaining"
