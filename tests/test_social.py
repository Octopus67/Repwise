"""Tests for social module — follows, feed, reactions, share codes."""

import uuid

import pytest

from src.modules.auth.models import User
from src.modules.social.models import FeedEvent, Follow
from src.modules.social.service import SocialService
from src.modules.training.models import WorkoutTemplate
from src.shared.errors import ConflictError, NotFoundError


async def _user(session) -> User:
    u = User(email=f"social_{uuid.uuid4().hex[:8]}@test.com", auth_provider="email", role="user")
    session.add(u)
    await session.flush()
    return u


async def _feed_event(session, user_id) -> FeedEvent:
    ev = FeedEvent(user_id=user_id, event_type="workout", ref_id=uuid.uuid4())
    session.add(ev)
    await session.flush()
    return ev


# --- Follow / Unfollow ---

@pytest.mark.asyncio
async def test_follow_creates_relationship(db_session):
    a, b = await _user(db_session), await _user(db_session)
    svc = SocialService(db_session)
    follow = await svc.follow_user(a.id, b.id)
    assert follow.follower_id == a.id
    assert follow.following_id == b.id


@pytest.mark.asyncio
async def test_unfollow_removes_relationship(db_session):
    a, b = await _user(db_session), await _user(db_session)
    svc = SocialService(db_session)
    await svc.follow_user(a.id, b.id)
    await svc.unfollow_user(a.id, b.id)
    with pytest.raises(NotFoundError):
        await svc.unfollow_user(a.id, b.id)


@pytest.mark.asyncio
async def test_self_follow_prevented(db_session):
    a = await _user(db_session)
    svc = SocialService(db_session)
    with pytest.raises(ConflictError, match="Cannot follow yourself"):
        await svc.follow_user(a.id, a.id)


@pytest.mark.asyncio
async def test_duplicate_follow_raises(db_session):
    a, b = await _user(db_session), await _user(db_session)
    svc = SocialService(db_session)
    await svc.follow_user(a.id, b.id)
    with pytest.raises(ConflictError, match="Already following"):
        await svc.follow_user(a.id, b.id)


# --- Feed ---

@pytest.mark.asyncio
async def test_feed_returns_followed_users_events(db_session):
    a, b, c = await _user(db_session), await _user(db_session), await _user(db_session)
    svc = SocialService(db_session)
    await svc.follow_user(a.id, b.id)  # a follows b, not c
    ev_b = await _feed_event(db_session, b.id)
    await _feed_event(db_session, c.id)  # c's event should NOT appear
    feed = await svc.get_feed(a.id, cursor_time=None, cursor_id=None)
    assert len(feed) == 1
    assert feed[0].id == ev_b.id


# --- Reactions ---

@pytest.mark.asyncio
async def test_add_and_remove_reaction(db_session):
    a = await _user(db_session)
    ev = await _feed_event(db_session, a.id)
    svc = SocialService(db_session)
    reaction = await svc.add_reaction(a.id, ev.id, "🔥")
    assert reaction.emoji == "🔥"
    await svc.remove_reaction(a.id, ev.id)
    with pytest.raises(NotFoundError):
        await svc.remove_reaction(a.id, ev.id)


@pytest.mark.asyncio
async def test_reaction_upsert(db_session):
    a = await _user(db_session)
    ev = await _feed_event(db_session, a.id)
    svc = SocialService(db_session)
    await svc.add_reaction(a.id, ev.id, "💪")
    updated = await svc.add_reaction(a.id, ev.id, "🔥")
    assert updated.emoji == "🔥"


# --- Share code ---

@pytest.mark.asyncio
async def test_share_code_generated(db_session):
    user = await _user(db_session)
    tmpl = WorkoutTemplate(user_id=user.id, name="PPL", exercises=[])
    db_session.add(tmpl)
    await db_session.flush()
    svc = SocialService(db_session)
    shared = await svc.share_template(user.id, tmpl.id)
    assert len(shared.share_code) > 0
    assert shared.copy_count == 0


@pytest.mark.asyncio
async def test_share_codes_are_unique(db_session):
    user = await _user(db_session)
    t1 = WorkoutTemplate(user_id=user.id, name="A", exercises=[])
    t2 = WorkoutTemplate(user_id=user.id, name="B", exercises=[])
    db_session.add_all([t1, t2])
    await db_session.flush()
    svc = SocialService(db_session)
    s1 = await svc.share_template(user.id, t1.id)
    s2 = await svc.share_template(user.id, t2.id)
    assert s1.share_code != s2.share_code
