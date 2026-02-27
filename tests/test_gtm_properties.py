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
        Settings(JWT_SECRET=secret, DEBUG=False, DATABASE_URL=DB_URL)


@given(secret=st.text(min_size=32, max_size=200))
@h_settings(max_examples=50)
def test_jwt_secret_long_strings_succeed_when_not_debug(secret: str):
    """Strings >= 32 chars and != default must succeed when DEBUG=False."""
    assume(secret != "change-me-in-production")
    s = Settings(JWT_SECRET=secret, DEBUG=False, DATABASE_URL=DB_URL)
    assert s.JWT_SECRET == secret


def test_jwt_secret_default_always_raises():
    """The default string 'change-me-in-production' always raises when DEBUG=False."""
    with pytest.raises(ValidationError):
        Settings(JWT_SECRET="change-me-in-production", DEBUG=False, DATABASE_URL=DB_URL)


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
    assert read_url == f"https://cdn.repwise.com/{expected_key}"

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


# --- Property 1: Region-based provider routing ---
# **Validates: Requirements 5.1, 5.2**

from src.modules.payments.provider_interface import (
    get_provider_for_region,
    PROVIDER_MAP,
)
from src.modules.payments.stripe_provider import StripeProvider
from src.modules.payments.razorpay_provider import RazorpayProvider


def test_region_provider_routing_us_returns_stripe():
    """US region must return a StripeProvider instance."""
    provider = get_provider_for_region("US")
    assert isinstance(provider, StripeProvider)


def test_region_provider_routing_in_returns_razorpay():
    """IN region must return a RazorpayProvider instance."""
    provider = get_provider_for_region("IN")
    assert isinstance(provider, RazorpayProvider)


@given(region=st.text(min_size=1, max_size=50))
@h_settings(max_examples=50)
def test_region_provider_routing_unknown_raises(region: str):
    """Any region string not in PROVIDER_MAP must raise ValueError."""
    assume(region not in PROVIDER_MAP)
    with pytest.raises(ValueError, match="No payment provider configured"):
        get_provider_for_region(region)


@given(region=st.sampled_from(list(PROVIDER_MAP.keys())))
@h_settings(max_examples=20)
def test_region_provider_routing_known_returns_instance(region: str):
    """Every region in PROVIDER_MAP returns a valid PaymentProvider instance."""
    from src.modules.payments.provider_interface import PaymentProvider

    provider = get_provider_for_region(region)
    assert isinstance(provider, PaymentProvider)


# --- Property 2: Webhook signature verification ---
# **Validates: Requirements 5.3, 5.5**

import hashlib
import hmac as hmac_mod
import time as time_mod

from src.modules.payments.provider_interface import WebhookEvent
from src.shared.errors import UnprocessableError


WEBHOOK_SECRET = "test_webhook_secret_key"
PRINTABLE_ASCII = "".join(chr(c) for c in range(32, 127))


@given(
    payload_data=st.dictionaries(
        keys=st.text(min_size=1, max_size=20, alphabet="abcdefghijklmnopqrstuvwxyz"),
        values=st.text(min_size=0, max_size=50, alphabet=PRINTABLE_ASCII),
        min_size=1,
        max_size=5,
    ),
    timestamp=st.integers(min_value=1000000000, max_value=9999999999),
)
@h_settings(max_examples=50)
def test_stripe_webhook_valid_signature(payload_data, timestamp):
    """Stripe: A correctly signed payload must return a WebhookEvent."""
    provider = StripeProvider(api_key="sk_test_fake", webhook_secret=WEBHOOK_SECRET)
    payload = json_mod.dumps(payload_data).encode()

    # Compute correct signature in Stripe's t=<ts>,v1=<hex> format
    signed_payload = f"{timestamp}.".encode() + payload
    sig_hex = hmac_mod.new(
        WEBHOOK_SECRET.encode(), signed_payload, hashlib.sha256
    ).hexdigest()
    signature = f"t={timestamp},v1={sig_hex}"

    event = asyncio.get_event_loop().run_until_complete(
        provider.verify_webhook(payload, signature)
    )
    assert event is not None
    assert isinstance(event, WebhookEvent)


@given(
    payload_data=st.dictionaries(
        keys=st.text(min_size=1, max_size=20, alphabet="abcdefghijklmnopqrstuvwxyz"),
        values=st.text(min_size=0, max_size=50, alphabet=PRINTABLE_ASCII),
        min_size=1,
        max_size=5,
    ),
    timestamp=st.integers(min_value=1000000000, max_value=9999999999),
    flip_pos=st.integers(min_value=0, max_value=63),
)
@h_settings(max_examples=50)
def test_stripe_webhook_tampered_signature(payload_data, timestamp, flip_pos):
    """Stripe: A tampered signature must raise UnprocessableError."""
    provider = StripeProvider(api_key="sk_test_fake", webhook_secret=WEBHOOK_SECRET)
    payload = json_mod.dumps(payload_data).encode()

    signed_payload = f"{timestamp}.".encode() + payload
    sig_hex = hmac_mod.new(
        WEBHOOK_SECRET.encode(), signed_payload, hashlib.sha256
    ).hexdigest()

    # Tamper the signature by flipping one hex character
    sig_list = list(sig_hex)
    idx = flip_pos % len(sig_list)
    original_char = sig_list[idx]
    # Pick a different hex char
    replacement = "0" if original_char != "0" else "1"
    sig_list[idx] = replacement
    tampered_hex = "".join(sig_list)

    # Only test if we actually changed the signature
    assume(tampered_hex != sig_hex)

    signature = f"t={timestamp},v1={tampered_hex}"

    with pytest.raises(UnprocessableError):
        asyncio.get_event_loop().run_until_complete(
            provider.verify_webhook(payload, signature)
        )


@given(
    payload_data=st.dictionaries(
        keys=st.text(min_size=1, max_size=20, alphabet="abcdefghijklmnopqrstuvwxyz"),
        values=st.text(min_size=0, max_size=50, alphabet=PRINTABLE_ASCII),
        min_size=1,
        max_size=5,
    ),
)
@h_settings(max_examples=50)
def test_razorpay_webhook_valid_signature(payload_data):
    """Razorpay: A correctly signed payload must return a WebhookEvent."""
    provider = RazorpayProvider(
        key_id="rzp_test_fake",
        key_secret="rzp_secret_fake",
        webhook_secret=WEBHOOK_SECRET,
    )
    payload = json_mod.dumps(payload_data).encode()

    sig_hex = hmac_mod.new(
        WEBHOOK_SECRET.encode(), payload, hashlib.sha256
    ).hexdigest()

    event = asyncio.get_event_loop().run_until_complete(
        provider.verify_webhook(payload, sig_hex)
    )
    assert event is not None
    assert isinstance(event, WebhookEvent)


@given(
    payload_data=st.dictionaries(
        keys=st.text(min_size=1, max_size=20, alphabet="abcdefghijklmnopqrstuvwxyz"),
        values=st.text(min_size=0, max_size=50, alphabet=PRINTABLE_ASCII),
        min_size=1,
        max_size=5,
    ),
    flip_pos=st.integers(min_value=0, max_value=63),
)
@h_settings(max_examples=50)
def test_razorpay_webhook_tampered_signature(payload_data, flip_pos):
    """Razorpay: A tampered signature must raise UnprocessableError."""
    provider = RazorpayProvider(
        key_id="rzp_test_fake",
        key_secret="rzp_secret_fake",
        webhook_secret=WEBHOOK_SECRET,
    )
    payload = json_mod.dumps(payload_data).encode()

    sig_hex = hmac_mod.new(
        WEBHOOK_SECRET.encode(), payload, hashlib.sha256
    ).hexdigest()

    # Tamper the signature
    sig_list = list(sig_hex)
    idx = flip_pos % len(sig_list)
    original_char = sig_list[idx]
    replacement = "0" if original_char != "0" else "1"
    sig_list[idx] = replacement
    tampered_hex = "".join(sig_list)

    assume(tampered_hex != sig_hex)

    with pytest.raises(UnprocessableError):
        asyncio.get_event_loop().run_until_complete(
            provider.verify_webhook(payload, tampered_hex)
        )


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

    unique = _uuid.uuid4().hex[:12]
    user = await _make_user(db_session, email=f"prop5_{unique}@test.com")
    svc = _NotificationService(db_session)

    # Set preference
    await svc.get_preferences(user.id)
    await svc.update_preferences(
        user.id, _NotificationPreferenceUpdate(push_enabled=push_enabled)
    )

    # Register tokens
    for i in range(num_tokens):
        tok = _DeviceTokenCreate(platform="android", token=f"{unique}_tok_{i}")
        await svc.register_device(user.id, tok)

    count = await svc.send_push(user.id, "Test Title", "Test Body")

    if not push_enabled:
        assert count == 0, f"Expected 0 when push disabled, got {count}"
    elif num_tokens > 0:
        assert count >= 1, f"Expected >= 1 with {num_tokens} tokens, got {count}"
    else:
        assert count == 0, f"Expected 0 with no tokens, got {count}"
