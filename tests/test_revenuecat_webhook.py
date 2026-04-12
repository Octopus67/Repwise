"""Tests for RevenueCat webhook handler — auth, event processing, idempotency."""

import json
import uuid
from datetime import datetime, timezone
from unittest.mock import patch

import pytest

from src.modules.auth.models import User
from src.modules.payments.models import Subscription
from src.modules.payments.service import PaymentService
from src.shared.errors import UnprocessableError
from src.shared.types import SubscriptionStatus

WEBHOOK_KEY = "test-webhook-secret"
SETTINGS_PATH = "src.modules.payments.revenuecat_provider.settings"


@pytest.fixture
def mock_rc_settings():
    with patch(SETTINGS_PATH) as m:
        m.REVENUECAT_API_KEY = "k"
        m.REVENUECAT_WEBHOOK_AUTH_KEY = WEBHOOK_KEY
        m.REVENUECAT_API_URL = "http://test"
        yield m


async def _user(session) -> User:
    u = User(email=f"rc_{uuid.uuid4().hex[:8]}@test.com", auth_provider="email", role="user")
    session.add(u)
    await session.flush()
    return u


async def _sub(session, uid, status=SubscriptionStatus.FREE, txn="txn_1") -> Subscription:
    s = Subscription(
        user_id=uid,
        provider_name="revenuecat",
        status=status,
        provider_subscription_id=txn,
        currency="USD",
        region="US",
    )
    session.add(s)
    await session.flush()
    return s


def _payload(etype, uid, eid="evt_1", txn="txn_1", exp_ms=None) -> bytes:
    ev = {"type": etype, "id": eid, "app_user_id": uid, "original_transaction_id": txn}
    if exp_ms:
        ev["expiration_at_ms"] = exp_ms
    return json.dumps({"event": ev}).encode()


async def _handle(session, etype, uid, eid="evt_1", txn="txn_1", exp_ms=None):
    svc = PaymentService(session)
    return await svc.handle_webhook(_payload(etype, uid, eid, txn, exp_ms), f"Bearer {WEBHOOK_KEY}")


# --- Auth tests ---


@pytest.mark.asyncio
async def test_valid_bearer_token(db_session, mock_rc_settings):
    user = await _user(db_session)
    event = await _handle(db_session, "INITIAL_PURCHASE", str(user.id))
    assert event.event_type == "subscription.activated"


@pytest.mark.asyncio
async def test_invalid_token_rejected(db_session, mock_rc_settings):
    svc = PaymentService(db_session)
    with pytest.raises(UnprocessableError):
        await svc.handle_webhook(b'{"event":{}}', "Bearer wrong-key")


@pytest.mark.asyncio
async def test_missing_auth_header(db_session, mock_rc_settings):
    svc = PaymentService(db_session)
    with pytest.raises(UnprocessableError):
        await svc.handle_webhook(b'{"event":{}}', "")


# --- Event processing tests ---


@pytest.mark.asyncio
async def test_initial_purchase_activates(db_session, mock_rc_settings):
    user = await _user(db_session)
    sub = await _sub(db_session, user.id)
    await _handle(db_session, "INITIAL_PURCHASE", str(user.id))
    await db_session.refresh(sub)
    assert sub.status == SubscriptionStatus.ACTIVE


@pytest.mark.asyncio
async def test_renewal_extends_period(db_session, mock_rc_settings):
    user = await _user(db_session)
    sub = await _sub(db_session, user.id, status=SubscriptionStatus.ACTIVE)
    exp_ms = int(datetime(2025, 2, 1, tzinfo=timezone.utc).timestamp() * 1000)
    await _handle(
        db_session, "RENEWAL", str(user.id), "evt_2", sub.provider_subscription_id, exp_ms
    )
    await db_session.refresh(sub)
    assert sub.status == SubscriptionStatus.ACTIVE
    assert sub.current_period_end is not None


@pytest.mark.asyncio
async def test_cancellation_sets_cancelled(db_session, mock_rc_settings):
    user = await _user(db_session)
    sub = await _sub(db_session, user.id, status=SubscriptionStatus.ACTIVE)
    await _handle(db_session, "CANCELLATION", str(user.id), "evt_3", sub.provider_subscription_id)
    await db_session.refresh(sub)
    assert sub.status == SubscriptionStatus.CANCELLED


@pytest.mark.asyncio
async def test_expiration_sets_cancelled(db_session, mock_rc_settings):
    user = await _user(db_session)
    sub = await _sub(db_session, user.id, status=SubscriptionStatus.ACTIVE)
    await _handle(db_session, "EXPIRATION", str(user.id), "evt_4", sub.provider_subscription_id)
    await db_session.refresh(sub)
    assert sub.status == SubscriptionStatus.CANCELLED


@pytest.mark.asyncio
async def test_idempotency_skips_duplicate(db_session, mock_rc_settings):
    user = await _user(db_session)
    sub = await _sub(db_session, user.id)
    svc = PaymentService(db_session)
    p = _payload("INITIAL_PURCHASE", str(user.id), eid="evt_dup")
    await svc.handle_webhook(p, f"Bearer {WEBHOOK_KEY}")
    await db_session.refresh(sub)
    assert sub.status == SubscriptionStatus.ACTIVE
    # Second call — idempotent, no error
    await svc.handle_webhook(p, f"Bearer {WEBHOOK_KEY}")


@pytest.mark.asyncio
async def test_unknown_event_type_handled(db_session, mock_rc_settings):
    user = await _user(db_session)
    event = await _handle(db_session, "SOME_FUTURE_EVENT", str(user.id), eid="evt_unk")
    assert event.event_type == "some_future_event"
