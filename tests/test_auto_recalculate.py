"""Test auto-recalculate functionality in user service."""

import pytest
import uuid
from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

from src.modules.user.service import UserService
from src.modules.user.schemas import BodyweightLogCreate
from src.modules.adaptive.models import AdaptiveSnapshot
from src.modules.user.models import BodyweightLog, UserGoal, UserMetric, UserProfile


def _user_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.mark.asyncio
async def test_auto_recalculate_on_significant_weight_change(db_session):
    """Test that auto-recalculate triggers when weight changes significantly."""
    service = UserService(db_session)
    user_id = _user_id()
    
    # Setup: Create existing snapshot with weight 80kg
    existing_snapshot = AdaptiveSnapshot(
        user_id=user_id,
        target_calories=2000,
        target_protein_g=160,
        target_carbs_g=200,
        target_fat_g=67,
        ema_current=80.0,  # Previous weight
        adjustment_factor=0.0,
        input_parameters={}
    )
    db_session.add(existing_snapshot)
    
    # Create user profile with age/sex
    profile = UserProfile(
        user_id=user_id,
        preferences={"age_years": 30, "sex": "male"}
    )
    db_session.add(profile)
    
    # Create user goal
    goal = UserGoal(
        user_id=user_id,
        goal_type="cutting",
        goal_rate_per_week=-0.5
    )
    db_session.add(goal)
    
    # Create user metrics
    metrics = UserMetric(
        user_id=user_id,
        height_cm=180,
        weight_kg=82.0,  # New weight - 2kg difference
        activity_level="moderate"
    )
    db_session.add(metrics)
    
    # Add some bodyweight history
    for i in range(7):
        bw_log = BodyweightLog(
            user_id=user_id,
            weight_kg=82.0,  # Consistent new weight
            recorded_date=date.today() - timedelta(days=i)
        )
        db_session.add(bw_log)
    
    await db_session.flush()
    
    # Mock compute_snapshot to return predictable results
    with patch('src.modules.user.service.compute_snapshot') as mock_compute:
        mock_compute.return_value = type('MockOutput', (), {
            'target_calories': 1950,
            'target_protein_g': 164,
            'target_carbs_g': 195,
            'target_fat_g': 65,
            'ema_current': 82.0,
            'adjustment_factor': -50.0
        })()
        
        # Log new bodyweight that should trigger auto-recalculate
        result = await service.log_bodyweight(
            user_id,
            BodyweightLogCreate(weight_kg=82.0, recorded_date=date.today())
        )
        
        # Verify compute_snapshot was called (auto-recalculate triggered)
        assert mock_compute.called
        
        # Verify new snapshot was created
        from sqlalchemy import select, func
        count = await db_session.execute(
            select(func.count()).select_from(AdaptiveSnapshot).where(
                AdaptiveSnapshot.user_id == user_id
            )
        )
        assert count.scalar() == 2  # Original + new snapshot


@pytest.mark.asyncio
async def test_no_auto_recalculate_on_small_weight_change(db_session):
    """Test that auto-recalculate does NOT trigger for small weight changes."""
    service = UserService(db_session)
    user_id = _user_id()
    
    # Setup: Create existing snapshot with weight 80kg
    existing_snapshot = AdaptiveSnapshot(
        user_id=user_id,
        target_calories=2000,
        target_protein_g=160,
        target_carbs_g=200,
        target_fat_g=67,
        ema_current=80.0,  # Previous weight
        adjustment_factor=0.0,
        input_parameters={}
    )
    db_session.add(existing_snapshot)
    
    # Add some bodyweight history with small change
    for i in range(7):
        bw_log = BodyweightLog(
            user_id=user_id,
            weight_kg=80.5,  # Only 0.5kg difference
            recorded_date=date.today() - timedelta(days=i)
        )
        db_session.add(bw_log)
    
    await db_session.flush()
    
    # Mock compute_snapshot
    with patch('src.modules.user.service.compute_snapshot') as mock_compute:
        # Log new bodyweight with small change
        result = await service.log_bodyweight(
            user_id,
            BodyweightLogCreate(weight_kg=80.5, recorded_date=date.today())
        )
        
        # Verify compute_snapshot was NOT called (no auto-recalculate)
        assert not mock_compute.called
        
        # Verify no new snapshot was created
        from sqlalchemy import select, func
        count = await db_session.execute(
            select(func.count()).select_from(AdaptiveSnapshot).where(
                AdaptiveSnapshot.user_id == user_id
            )
        )
        assert count.scalar() == 1  # Only original snapshot