"""Unit tests for the notification service.

Requirements: 7.4, 7.5
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from src.modules.auth.models import User
from src.modules.notifications.models import DeviceToken, NotificationPreference
from src.modules.notifications.schemas import DeviceTokenCreate, NotificationPreferenceUpdate
from src.modules.notifications.service import NotificationService
from src.shared.errors import NotFoundError


async def _create_user(session, email: str = "test@example.com") -> User:
    """Helper to create a user for FK constraints."""
    user = User(
        email=email,
        hashed_password="hashed_pw_placeholder",
        auth_provider="email",
        role="user",
    )
    session.add(user)
    await session.flush()
    return user


# --- 1. register_device creates token ---

@pytest.mark.asyncio
async def test_register_device_creates_token(db_session):
    user = await _create_user(db_session)
    svc = NotificationService(db_session)

    data = DeviceTokenCreate(platform="ios", token="abc123token")
    device = await svc.register_device(user.id, data)

    assert device.user_id == user.id
    assert device.platform == "ios"
    assert device.token == "abc123token"
    assert device.is_active is True


# --- 2. register_device with duplicate token reassigns ---

@pytest.mark.asyncio
async def test_register_device_duplicate_token_reassigns(db_session):
    user_a = await _create_user(db_session, email="a@example.com")
    user_b = await _create_user(db_session, email="b@example.com")
    svc = NotificationService(db_session)

    data = DeviceTokenCreate(platform="android", token="shared_token_xyz")
    device_a = await svc.register_device(user_a.id, data)
    assert device_a.user_id == user_a.id

    # Re-register same token for user_b
    device_b = await svc.register_device(user_b.id, data)
    assert device_b.user_id == user_b.id
    assert device_b.token == "shared_token_xyz"
    assert device_b.is_active is True


# --- 3. unregister_device removes token ---

@pytest.mark.asyncio
async def test_unregister_device_removes_token(db_session):
    user = await _create_user(db_session)
    svc = NotificationService(db_session)

    data = DeviceTokenCreate(platform="ios", token="remove_me_token")
    device = await svc.register_device(user.id, data)
    token_id = device.id

    await svc.unregister_device(user.id, token_id)

    stmt = select(DeviceToken).where(DeviceToken.id == token_id)
    result = await db_session.execute(stmt)
    assert result.scalar_one_or_none() is None


# --- 4. unregister_device with wrong user_id raises NotFoundError ---

@pytest.mark.asyncio
async def test_unregister_device_wrong_user_raises(db_session):
    user = await _create_user(db_session)
    svc = NotificationService(db_session)

    data = DeviceTokenCreate(platform="android", token="wrong_user_token")
    device = await svc.register_device(user.id, data)

    wrong_user_id = uuid.uuid4()
    with pytest.raises(NotFoundError):
        await svc.unregister_device(wrong_user_id, device.id)


# --- 5. get_preferences creates defaults on first call ---

@pytest.mark.asyncio
async def test_get_preferences_creates_defaults(db_session):
    user = await _create_user(db_session)
    svc = NotificationService(db_session)

    prefs = await svc.get_preferences(user.id)

    assert prefs.user_id == user.id
    assert prefs.push_enabled is True
    assert prefs.coaching_reminders is True
    assert prefs.subscription_alerts is True


# --- 6. update_preferences partial update works ---

@pytest.mark.asyncio
async def test_update_preferences_partial_update(db_session):
    user = await _create_user(db_session)
    svc = NotificationService(db_session)

    # Create defaults first
    await svc.get_preferences(user.id)

    update = NotificationPreferenceUpdate(push_enabled=False)
    prefs = await svc.update_preferences(user.id, update)

    assert prefs.push_enabled is False
    # Other fields remain at defaults
    assert prefs.coaching_reminders is True
    assert prefs.subscription_alerts is True


# --- 7. send_push with push_enabled=False returns 0 ---

@pytest.mark.asyncio
async def test_send_push_disabled_returns_zero(db_session):
    user = await _create_user(db_session)
    svc = NotificationService(db_session)

    # Disable push
    await svc.get_preferences(user.id)
    await svc.update_preferences(user.id, NotificationPreferenceUpdate(push_enabled=False))

    # Register a token so we know it's the preference blocking delivery
    await svc.register_device(user.id, DeviceTokenCreate(platform="ios", token="disabled_push_token"))

    count = await svc.send_push(user.id, "Test", "Body")
    assert count == 0


# --- 8. send_push with push_enabled=True and active tokens returns count > 0 ---

@pytest.mark.asyncio
async def test_send_push_enabled_with_tokens_returns_count(db_session):
    user = await _create_user(db_session)
    svc = NotificationService(db_session)

    # Ensure push is enabled (default)
    await svc.get_preferences(user.id)

    # Register two tokens
    await svc.register_device(user.id, DeviceTokenCreate(platform="ios", token="token_one"))
    await svc.register_device(user.id, DeviceTokenCreate(platform="android", token="token_two"))

    count = await svc.send_push(user.id, "Workout Reminder", "Time to train!")
    assert count == 2


# --- 9. deactivate_token sets is_active=False ---

@pytest.mark.asyncio
async def test_deactivate_token_sets_inactive(db_session):
    user = await _create_user(db_session)
    svc = NotificationService(db_session)

    data = DeviceTokenCreate(platform="ios", token="deactivate_me")
    device = await svc.register_device(user.id, data)
    assert device.is_active is True

    await svc.deactivate_token(device.id)

    stmt = select(DeviceToken).where(DeviceToken.id == device.id)
    result = await db_session.execute(stmt)
    updated = result.scalar_one()
    assert updated.is_active is False
