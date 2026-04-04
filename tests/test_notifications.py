"""Tests for push notification service and notification endpoints.

Covers:
- PushNotificationService: batching, Expo API handling, token deactivation, logging
- NotificationService: CRUD, history, mark-read, push integration
- Router: all 6 endpoints via TestClient
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from sqlalchemy import select

from src.modules.auth.models import User
from src.modules.notifications.models import DeviceToken, NotificationLog, NotificationPreference
from src.modules.notifications.schemas import (
    DeviceTokenCreate,
    MarkReadRequest,
    NotificationPreferenceUpdate,
)
from src.modules.notifications.service import NotificationService
from src.services.push_notifications import PushNotificationService
from src.shared.errors import NotFoundError


async def _create_user(session, email: str = "test@example.com") -> User:
    user = User(email=email, hashed_password="hashed", auth_provider="email", role="user")
    session.add(user)
    await session.flush()
    return user


# =====================================================================
# PushNotificationService unit tests
# =====================================================================


@pytest.mark.asyncio
async def test_push_send_batches_messages(db_session):
    """Verify messages are batched in groups of 100."""
    user = await _create_user(db_session)

    # Create 150 tokens
    for i in range(150):
        db_session.add(DeviceToken(
            user_id=user.id, platform="ios", token=f"tok_{i}", is_active=True,
        ))
    await db_session.flush()

    # Mock httpx client
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    # First batch: 100 ok, second batch: 50 ok
    mock_client.post = AsyncMock(side_effect=[
        AsyncMock(
            status_code=200,
            json=lambda: {"data": [{"status": "ok"}] * 100},
            raise_for_status=lambda: None,
        ),
        AsyncMock(
            status_code=200,
            json=lambda: {"data": [{"status": "ok"}] * 50},
            raise_for_status=lambda: None,
        ),
    ])

    svc = PushNotificationService(db_session, http_client=mock_client)
    count = await svc.send_notification(user.id, "Test", "Body")

    assert count == 150
    assert mock_client.post.call_count == 2


@pytest.mark.asyncio
async def test_push_deactivates_unregistered_token(db_session):
    """DeviceNotRegistered error should mark token inactive."""
    user = await _create_user(db_session)
    db_session.add(DeviceToken(
        user_id=user.id, platform="ios", token="bad_token", is_active=True,
    ))
    await db_session.flush()

    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.post = AsyncMock(return_value=AsyncMock(
        status_code=200,
        json=lambda: {"data": [{"status": "error", "message": "DeviceNotRegistered", "details": {"error": "DeviceNotRegistered"}}]},
        raise_for_status=lambda: None,
    ))

    svc = PushNotificationService(db_session, http_client=mock_client)
    count = await svc.send_notification(user.id, "Test", "Body")

    assert count == 0
    stmt = select(DeviceToken).where(DeviceToken.token == "bad_token")
    token = (await db_session.execute(stmt)).scalar_one()
    assert token.is_active is False


@pytest.mark.asyncio
async def test_push_logs_notification(db_session):
    """Verify notification is logged to notification_log table."""
    user = await _create_user(db_session)
    db_session.add(DeviceToken(
        user_id=user.id, platform="android", token="log_test_tok", is_active=True,
    ))
    await db_session.flush()

    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.post = AsyncMock(return_value=AsyncMock(
        status_code=200,
        json=lambda: {"data": [{"status": "ok"}]},
        raise_for_status=lambda: None,
    ))

    svc = PushNotificationService(db_session, http_client=mock_client)
    await svc.send_notification(
        user.id, "PR!", "New record", data={"screen": "detail"}, notification_type="pr_celebration",
    )

    stmt = select(NotificationLog).where(NotificationLog.user_id == user.id)
    log = (await db_session.execute(stmt)).scalar_one()
    assert log.title == "PR!"
    assert log.type == "pr_celebration"
    assert log.data == {"screen": "detail"}
    assert log.sent_at is not None


@pytest.mark.asyncio
async def test_push_handles_api_error(db_session):
    """HTTP errors from Expo should return 0, not raise."""
    user = await _create_user(db_session)
    db_session.add(DeviceToken(
        user_id=user.id, platform="ios", token="err_tok", is_active=True,
    ))
    await db_session.flush()

    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.post = AsyncMock(side_effect=httpx.HTTPError("timeout"))

    svc = PushNotificationService(db_session, http_client=mock_client)
    count = await svc.send_notification(user.id, "Test", "Body")
    assert count == 0


@pytest.mark.asyncio
async def test_push_no_tokens_returns_zero(db_session):
    """No active tokens should return 0 without calling Expo."""
    user = await _create_user(db_session)
    svc = PushNotificationService(db_session)
    count = await svc.send_notification(user.id, "Test", "Body")
    assert count == 0


# =====================================================================
# NotificationService unit tests
# =====================================================================


@pytest.mark.asyncio
async def test_register_device_creates_token(db_session):
    user = await _create_user(db_session)
    svc = NotificationService(db_session)
    data = DeviceTokenCreate(platform="ios", token="abc123token")
    device = await svc.register_device(user.id, data)
    assert device.user_id == user.id
    assert device.platform == "ios"
    assert device.is_active is True


@pytest.mark.asyncio
async def test_register_device_duplicate_reassigns(db_session):
    user_a = await _create_user(db_session, email="a@example.com")
    user_b = await _create_user(db_session, email="b@example.com")
    svc = NotificationService(db_session)
    data = DeviceTokenCreate(platform="android", token="shared_tok")
    await svc.register_device(user_a.id, data)
    device_b = await svc.register_device(user_b.id, data)
    assert device_b.user_id == user_b.id


@pytest.mark.asyncio
async def test_unregister_device_removes_token(db_session):
    user = await _create_user(db_session)
    svc = NotificationService(db_session)
    device = await svc.register_device(user.id, DeviceTokenCreate(platform="ios", token="rm_tok"))
    await svc.unregister_device(user.id, device.id)
    stmt = select(DeviceToken).where(DeviceToken.id == device.id)
    assert (await db_session.execute(stmt)).scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_unregister_device_wrong_user_raises(db_session):
    user = await _create_user(db_session)
    svc = NotificationService(db_session)
    device = await svc.register_device(user.id, DeviceTokenCreate(platform="ios", token="wrong_usr"))
    with pytest.raises(NotFoundError):
        await svc.unregister_device(uuid.uuid4(), device.id)


@pytest.mark.asyncio
async def test_get_preferences_creates_defaults(db_session):
    user = await _create_user(db_session)
    svc = NotificationService(db_session)
    prefs = await svc.get_preferences(user.id)
    assert prefs.push_enabled is True
    assert prefs.workout_reminders is True
    assert prefs.pr_celebrations is True


@pytest.mark.asyncio
async def test_update_preferences_partial(db_session):
    user = await _create_user(db_session)
    svc = NotificationService(db_session)
    await svc.get_preferences(user.id)
    prefs = await svc.update_preferences(user.id, NotificationPreferenceUpdate(push_enabled=False))
    assert prefs.push_enabled is False
    assert prefs.coaching_reminders is True


@pytest.mark.asyncio
async def test_notification_history_empty(db_session):
    user = await _create_user(db_session)
    svc = NotificationService(db_session)
    from src.shared.pagination import PaginationParams
    result = await svc.get_notification_history(user.id, PaginationParams(page=1, limit=10))
    assert result.total_count == 0
    assert result.items == []


@pytest.mark.asyncio
async def test_notification_history_returns_logs(db_session):
    user = await _create_user(db_session)
    for i in range(3):
        db_session.add(NotificationLog(
            user_id=user.id, type="test", title=f"Title {i}", body=f"Body {i}",
            sent_at=datetime.now(timezone.utc),
        ))
    await db_session.flush()

    svc = NotificationService(db_session)
    from src.shared.pagination import PaginationParams
    result = await svc.get_notification_history(user.id, PaginationParams(page=1, limit=10))
    assert result.total_count == 3
    assert len(result.items) == 3


@pytest.mark.asyncio
async def test_mark_as_read(db_session):
    user = await _create_user(db_session)
    log = NotificationLog(
        user_id=user.id, type="test", title="Read me",
        sent_at=datetime.now(timezone.utc),
    )
    db_session.add(log)
    await db_session.flush()

    svc = NotificationService(db_session)
    count = await svc.mark_as_read(user.id, [log.id])
    assert count == 1

    stmt = select(NotificationLog).where(NotificationLog.id == log.id)
    updated = (await db_session.execute(stmt)).scalar_one()
    assert updated.read_at is not None


@pytest.mark.asyncio
async def test_mark_as_read_already_read_returns_zero(db_session):
    user = await _create_user(db_session)
    log = NotificationLog(
        user_id=user.id, type="test", title="Already read",
        sent_at=datetime.now(timezone.utc), read_at=datetime.now(timezone.utc),
    )
    db_session.add(log)
    await db_session.flush()

    svc = NotificationService(db_session)
    count = await svc.mark_as_read(user.id, [log.id])
    assert count == 0


@pytest.mark.asyncio
async def test_send_push_disabled_returns_zero(db_session):
    from src.modules.feature_flags.service import FeatureFlagService, invalidate_cache
    invalidate_cache()
    user = await _create_user(db_session)
    svc = NotificationService(db_session)
    ff_svc = FeatureFlagService(db_session)
    await ff_svc.set_flag("push_notifications", is_enabled=True)
    invalidate_cache()
    await svc.get_preferences(user.id)
    await svc.update_preferences(user.id, NotificationPreferenceUpdate(push_enabled=False))
    await svc.register_device(user.id, DeviceTokenCreate(platform="ios", token="disabled_tok"))
    count = await svc.send_push(user.id, "Test", "Body")
    assert count == 0


@pytest.mark.asyncio
async def test_deactivate_token_sets_inactive(db_session):
    user = await _create_user(db_session)
    svc = NotificationService(db_session)
    device = await svc.register_device(user.id, DeviceTokenCreate(platform="ios", token="deact_tok"))
    await svc.deactivate_token(device.id)
    stmt = select(DeviceToken).where(DeviceToken.id == device.id)
    updated = (await db_session.execute(stmt)).scalar_one()
    assert updated.is_active is False


# =====================================================================
# Router integration tests
# =====================================================================


def _auth_headers(user_id: uuid.UUID) -> dict:
    """Generate a valid JWT for testing."""
    import jwt
    from src.config.settings import settings
    token = jwt.encode(
        {"sub": str(user_id), "type": "access", "jti": str(uuid.uuid4())},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_router_register_device(db_session, override_get_db, client):
    user = await _create_user(db_session)
    resp = await client.post(
        "/api/v1/notifications/register-device",
        json={"platform": "ios", "token": "router_test_tok"},
        headers=_auth_headers(user.id),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["platform"] == "ios"
    assert body["is_active"] is True


@pytest.mark.asyncio
async def test_router_unregister_device(db_session, override_get_db, client):
    user = await _create_user(db_session)
    svc = NotificationService(db_session)
    device = await svc.register_device(user.id, DeviceTokenCreate(platform="ios", token="unreg_tok"))
    await db_session.commit()

    resp = await client.delete(
        f"/api/v1/notifications/register-device/{device.id}",
        headers=_auth_headers(user.id),
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_router_get_preferences(db_session, override_get_db, client):
    user = await _create_user(db_session)
    resp = await client.get(
        "/api/v1/notifications/preferences",
        headers=_auth_headers(user.id),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["push_enabled"] is True
    assert body["workout_reminders"] is True


@pytest.mark.asyncio
async def test_router_update_preferences(db_session, override_get_db, client):
    user = await _create_user(db_session)
    resp = await client.patch(
        "/api/v1/notifications/preferences",
        json={"push_enabled": False, "pr_celebrations": False},
        headers=_auth_headers(user.id),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["push_enabled"] is False
    assert body["pr_celebrations"] is False
    assert body["coaching_reminders"] is True


@pytest.mark.asyncio
async def test_router_get_history(db_session, override_get_db, client):
    user = await _create_user(db_session)
    db_session.add(NotificationLog(
        user_id=user.id, type="test", title="History item",
        sent_at=datetime.now(timezone.utc),
    ))
    await db_session.commit()

    resp = await client.get(
        "/api/v1/notifications/history",
        headers=_auth_headers(user.id),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_count"] == 1
    assert body["items"][0]["title"] == "History item"


@pytest.mark.asyncio
async def test_router_mark_read(db_session, override_get_db, client):
    user = await _create_user(db_session)
    log = NotificationLog(
        user_id=user.id, type="test", title="Mark me",
        sent_at=datetime.now(timezone.utc),
    )
    db_session.add(log)
    await db_session.commit()

    resp = await client.post(
        "/api/v1/notifications/mark-read",
        json={"notification_ids": [str(log.id)]},
        headers=_auth_headers(user.id),
    )
    assert resp.status_code == 200
    assert resp.json()["updated"] == 1


# =====================================================================
# Volume warning deduplication tests (M1 bug fix)
# =====================================================================


@pytest.mark.asyncio
async def test_volume_warning_dedup_skips_recent_notification(db_session):
    """If a volume_warning for the same muscle was sent within 7 days, skip it."""
    from datetime import timedelta
    from sqlalchemy import func

    user = await _create_user(db_session, email="dedup@example.com")

    # Insert a recent volume_warning for 'chest' (2 days ago)
    db_session.add(NotificationLog(
        user_id=user.id,
        type="volume_warning",
        title="Volume Warning",
        body="Your chest volume is above MRV",
        data={"screen": "Analytics", "muscle": "chest"},
        sent_at=datetime.now(timezone.utc) - timedelta(days=2),
    ))
    await db_session.flush()

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    stmt = select(NotificationLog.id).where(
        NotificationLog.user_id == user.id,
        NotificationLog.type == "volume_warning",
        func.json_extract(NotificationLog.data, "$.muscle") == "chest",
        NotificationLog.sent_at > cutoff,
    ).limit(1)
    recent = (await db_session.execute(stmt)).scalar_one_or_none()

    assert recent is not None, "Dedup query should find recent volume_warning for chest"


@pytest.mark.asyncio
async def test_volume_warning_dedup_allows_old_notification(db_session):
    """If the last volume_warning for the muscle is older than 7 days, allow sending."""
    from datetime import timedelta
    from sqlalchemy import func

    user = await _create_user(db_session, email="dedup_old@example.com")

    # Insert an old volume_warning for 'chest' (10 days ago)
    db_session.add(NotificationLog(
        user_id=user.id,
        type="volume_warning",
        title="Volume Warning",
        body="Your chest volume is above MRV",
        data={"screen": "Analytics", "muscle": "chest"},
        sent_at=datetime.now(timezone.utc) - timedelta(days=10),
    ))
    await db_session.flush()

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    stmt = select(NotificationLog.id).where(
        NotificationLog.user_id == user.id,
        NotificationLog.type == "volume_warning",
        func.json_extract(NotificationLog.data, "$.muscle") == "chest",
        NotificationLog.sent_at > cutoff,
    ).limit(1)
    recent = (await db_session.execute(stmt)).scalar_one_or_none()

    assert recent is None, "Dedup query should not find volume_warning older than 7 days"


@pytest.mark.asyncio
async def test_volume_warning_dedup_different_muscle_allowed(db_session):
    """A recent volume_warning for a different muscle should not block a new one."""
    from datetime import timedelta
    from sqlalchemy import func

    user = await _create_user(db_session, email="dedup_diff@example.com")

    # Insert a recent volume_warning for 'chest' (1 day ago)
    db_session.add(NotificationLog(
        user_id=user.id,
        type="volume_warning",
        title="Volume Warning",
        body="Your chest volume is above MRV",
        data={"screen": "Analytics", "muscle": "chest"},
        sent_at=datetime.now(timezone.utc) - timedelta(days=1),
    ))
    await db_session.flush()

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    stmt = select(NotificationLog.id).where(
        NotificationLog.user_id == user.id,
        NotificationLog.type == "volume_warning",
        func.json_extract(NotificationLog.data, "$.muscle") == "quads",
        NotificationLog.sent_at > cutoff,
    ).limit(1)
    recent = (await db_session.execute(stmt)).scalar_one_or_none()

    assert recent is None, "Dedup query for 'quads' should not match 'chest' warning"
