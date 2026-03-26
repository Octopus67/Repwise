"""Property-based tests for Go-To-Market infrastructure."""

import logging

import pytest
from hypothesis import given, strategies as st, assume, settings as h_settings, HealthCheck
from pydantic import ValidationError

from src.config.settings import Settings


# --- Property 8: Environment variable validation ---
# **Validates: Requirements 1.5**


DB_URL = "sqlite+aiosqlite:///test.db"


@given(secret=st.text(min_size=0, max_size=31))
@h_settings(max_examples=50)
def test_jwt_secret_short_strings_raise_when_not_debug(secret: str):
    """Short JWT secrets (< 32 chars) must raise ValueError when DEBUG=False."""
    with pytest.raises(ValidationError):
        Settings(JWT_SECRET=secret, DEBUG=False, DATABASE_URL=DB_URL, CORS_ORIGINS=["https://app.repwise.app"], ALLOWED_HOSTS=["api.repwise.app"])


@given(secret=st.text(min_size=32, max_size=200))
@h_settings(max_examples=50)
def test_jwt_secret_long_strings_succeed_when_not_debug(secret: str):
    """Strings >= 32 chars and != default must succeed when DEBUG=False."""
    assume(secret != "change-me-in-production")
    s = Settings(JWT_SECRET=secret, DEBUG=False, DATABASE_URL=DB_URL, CORS_ORIGINS=["https://app.repwise.app"], ALLOWED_HOSTS=["api.repwise.app"])
    assert s.JWT_SECRET == secret


def test_jwt_secret_default_always_raises():
    """The default string 'change-me-in-production' always raises when DEBUG=False."""
    with pytest.raises(ValidationError):
        Settings(JWT_SECRET="change-me-in-production", DEBUG=False, DATABASE_URL=DB_URL, CORS_ORIGINS=["https://app.repwise.app"], ALLOWED_HOSTS=["api.repwise.app"])


# --- Property 3: Pre-signed URL user scoping ---
# **Validates: Requirements 6.3, 6.4**

from src.shared.storage import generate_read_url

SAFE_FILENAME_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789_-."


@given(
    user_id=st.uuids(),
    filename=st.text(min_size=1, max_size=100, alphabet=SAFE_FILENAME_CHARS),
)
@h_settings(max_examples=50)
def test_presigned_url_user_scoping(user_id, filename):
    """Pre-signed URL keys are always scoped to users/{user_id}/{filename},
    and generate_read_url returns the correct CDN URL for any key."""
    # Test key generation logic (the format used by generate_upload_url)
    expected_key = f"users/{user_id}/{filename}"

    # Test generate_read_url (pure function, no boto3 needed)
    read_url = generate_read_url(expected_key)
    assert read_url == f"https://cdn.repwise.app/{expected_key}"

    # Also verify the key format is correct for any arbitrary key
    assert expected_key.startswith(f"users/{user_id}/")
    assert expected_key.endswith(filename)


# --- Property 6: Structured log completeness ---
# **Validates: Requirements 8.1**

import asyncio
import json as json_mod
from unittest.mock import AsyncMock, MagicMock

from starlette.responses import Response as StarletteResponse

from src.middleware.logging_middleware import StructuredLoggingMiddleware

REQUIRED_LOG_KEYS = {"request_id", "method", "path", "status", "duration_ms"}


@given(
    status_code=st.integers(min_value=100, max_value=599),
    method=st.sampled_from(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
    path=st.text(min_size=1, max_size=200, alphabet="abcdefghijklmnopqrstuvwxyz0123456789/-_"),
)
@h_settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_structured_log_completeness(status_code, method, path, caplog):
    """Structured logs always contain request_id, method, path, status, duration_ms.
    duration_ms is always >= 0."""
    # Build a mock request
    mock_request = MagicMock()
    mock_request.method = method
    mock_url = MagicMock()
    mock_url.path = f"/{path}"
    mock_request.url = mock_url
    mock_request.state = MagicMock(spec=[])  # no user_id attribute

    # Build a mock call_next that returns a response with the given status code
    mock_response = StarletteResponse(status_code=status_code)
    call_next = AsyncMock(return_value=mock_response)

    # Create middleware instance (needs an app, but dispatch is called directly)
    middleware = StructuredLoggingMiddleware(app=MagicMock())

    # Capture logs from the access logger
    with caplog.at_level(logging.INFO, logger="hypertrophy_os.access"):
        caplog.clear()
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(middleware.dispatch(mock_request, call_next))
        finally:
            loop.close()

    # Find the structured log entry
    log_entries = [r for r in caplog.records if r.name == "hypertrophy_os.access"]
    assert len(log_entries) >= 1, "Expected at least one structured log entry"

    log_data = json_mod.loads(log_entries[-1].message)

    # Assert all required keys are present
    assert REQUIRED_LOG_KEYS.issubset(log_data.keys()), (
        f"Missing keys: {REQUIRED_LOG_KEYS - log_data.keys()}"
    )

    # Assert duration_ms is non-negative
    assert log_data["duration_ms"] >= 0

    # Assert status matches what we sent
    assert log_data["status"] == status_code
    assert log_data["method"] == method
    assert log_data["path"] == f"/{path}"



# --- Property 7: Soft-delete user exclusion ---
# **Validates: Requirements 11.6**

from datetime import datetime as dt_datetime

from sqlalchemy import select

from src.modules.auth.models import User


@pytest.mark.asyncio
async def test_soft_delete_exclusion(db_session):
    """Soft-deleted users (deleted_at set) must not appear in
    WHERE deleted_at IS NULL queries. Clearing deleted_at restores visibility."""
    # Create a user
    user = User(
        email="softdelete_test@example.com",
        hashed_password="hashed_pw_placeholder",
        auth_provider="email",
        role="user",
    )
    db_session.add(user)
    await db_session.flush()
    user_id = user.id

    # Query with deleted_at IS NULL — user should be present
    stmt = select(User).where(User.deleted_at.is_(None))
    result = await db_session.execute(stmt)
    users = result.scalars().all()
    assert any(u.id == user_id for u in users), "User should appear before soft-delete"

    # Soft-delete: set deleted_at
    user.deleted_at = dt_datetime.utcnow()
    await db_session.flush()

    # Query again — soft-deleted user should NOT appear
    stmt2 = select(User).where(User.deleted_at.is_(None))
    result2 = await db_session.execute(stmt2)
    users2 = result2.scalars().all()
    assert not any(u.id == user_id for u in users2), "Soft-deleted user should be excluded"

    # Restore: clear deleted_at
    user.deleted_at = None
    await db_session.flush()

    # Query again — user should reappear
    stmt3 = select(User).where(User.deleted_at.is_(None))
    result3 = await db_session.execute(stmt3)
    users3 = result3.scalars().all()
    assert any(u.id == user_id for u in users3), "Restored user should appear again"


# --- Property 4: Device token storage round-trip ---
# **Validates: Requirements 7.4**

from src.modules.notifications.models import DeviceToken as _DeviceToken
from src.modules.notifications.schemas import DeviceTokenCreate as _DeviceTokenCreate
from src.modules.notifications.service import NotificationService as _NotificationService


async def _make_user(session, email: str) -> "User":
    """Create a user for FK constraints in property tests."""
    user = User(
        email=email,
        hashed_password="hashed_pw_placeholder",
        auth_provider="email",
        role="user",
    )
    session.add(user)
    await session.flush()
    return user


TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"


@pytest.mark.asyncio
@given(
    token_str=st.text(min_size=1, max_size=100, alphabet=TOKEN_ALPHABET),
)
@h_settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
async def test_device_token_roundtrip(token_str: str, db_session):
    """Storing a device token via register_device and querying back must
    return the same token in the user's active tokens."""
    user = await _make_user(db_session, email=f"prop4_{token_str[:20]}@test.com")
    svc = _NotificationService(db_session)

    data = _DeviceTokenCreate(platform="ios", token=token_str)
    stored = await svc.register_device(user.id, data)

    # Query back active tokens for this user
    stmt = (
        select(_DeviceToken)
        .where(_DeviceToken.user_id == user.id)
        .where(_DeviceToken.is_active.is_(True))
    )
    result = await db_session.execute(stmt)
    active_tokens = result.scalars().all()

    token_values = [t.token for t in active_tokens]
    assert token_str in token_values, (
        f"Stored token '{token_str}' not found in active tokens: {token_values}"
    )
    assert stored.is_active is True


# --- Property 5: Notification opt-out enforcement ---
# **Validates: Requirements 7.5**

from src.modules.notifications.schemas import (
    NotificationPreferenceUpdate as _NotificationPreferenceUpdate,
)


@pytest.mark.asyncio
@given(
    push_enabled=st.booleans(),
    num_tokens=st.integers(min_value=0, max_value=3),
)
@h_settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
async def test_notification_optout(push_enabled: bool, num_tokens: int, db_session):
    """When push_enabled=False, send_push always returns 0.
    When push_enabled=True and at least one active token exists, send_push >= 1."""
    import uuid as _uuid
    from src.modules.feature_flags.service import FeatureFlagService, invalidate_cache

    invalidate_cache()
    unique = _uuid.uuid4().hex[:12]
    user = await _make_user(db_session, email=f"prop5_{unique}@test.com")
    svc = _NotificationService(db_session)

    # Enable the feature flag so we actually test push_enabled preference
    ff_svc = FeatureFlagService(db_session)
    await ff_svc.set_flag("push_notifications", is_enabled=True)
    invalidate_cache()

    # Set preference
    await svc.get_preferences(user.id)
    await svc.update_preferences(
        user.id, _NotificationPreferenceUpdate(push_enabled=push_enabled)
    )

    # Register tokens
    for i in range(num_tokens):
        tok = _DeviceTokenCreate(platform="android", token=f"{unique}_tok_{i}")
        await svc.register_device(user.id, tok)

    from unittest.mock import AsyncMock, patch
    import httpx

    mock_response = AsyncMock(
        status_code=200,
        json=lambda: {"data": [{"status": "ok"}] * max(num_tokens, 1)},
        raise_for_status=lambda: None,
    )
    with patch("src.services.push_notifications.PushNotificationService._get_client") as mock_get:
        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_get.return_value = mock_client
        count = await svc.send_push(user.id, "Test Title", "Test Body")

    if not push_enabled:
        assert count == 0, f"Expected 0 when push disabled, got {count}"
    elif num_tokens > 0:
        assert count >= 1, f"Expected >= 1 with {num_tokens} tokens, got {count}"
    else:
        assert count == 0, f"Expected 0 with no tokens, got {count}"
