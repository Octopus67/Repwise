"""Property-based tests for the content module.

Tests Properties 21 and 19 from the design document using Hypothesis.
Operates at the service level (Property 21) and HTTP level (Property 19).
"""

from __future__ import annotations

import uuid

import pytest
from hypothesis import HealthCheck, given, settings as h_settings, strategies as st
from httpx import ASGITransport, AsyncClient
from jose import jwt

from src.config.settings import settings
from src.modules.auth.models import User
from src.modules.content.models import ArticleVersion, ContentArticle, ContentModule
from src.modules.content.schemas import ArticleCreate, ArticleUpdate
from src.modules.content.service import ContentService
from src.shared.types import ContentStatus, UserRole

# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_titles = st.text(
    alphabet=st.characters(
        whitelist_categories=("L", "N", "Zs"),
        min_codepoint=32,
        max_codepoint=127,
    ),
    min_size=1,
    max_size=100,
).filter(lambda s: s.strip() != "")

_markdown_content = st.text(
    alphabet=st.characters(
        whitelist_categories=("L", "N", "Zs", "Po"),
        min_codepoint=32,
        max_codepoint=127,
    ),
    min_size=0,
    max_size=500,
)

_fixture_settings = h_settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_module(session) -> ContentModule:
    """Create a content module for testing."""
    module = ContentModule(
        name=f"Module-{uuid.uuid4().hex[:8]}",
        slug=f"module-{uuid.uuid4().hex[:8]}",
        description="Test module",
        sort_order=0,
    )
    session.add(module)
    await session.flush()
    return module


async def _create_article(
    session, module_id: uuid.UUID, title: str = "Test Article", content: str = "Body"
) -> ContentArticle:
    """Create a draft article for testing."""
    service = ContentService(session)
    data = ArticleCreate(
        module_id=module_id,
        title=title,
        content_markdown=content,
    )
    return await service.create_article(data=data)


def _make_token(user_id: uuid.UUID, role: str = UserRole.USER) -> str:
    """Create a JWT token for testing."""
    from datetime import datetime, timedelta, timezone

    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


# ---------------------------------------------------------------------------
# Property 21: Content versioning preservation
# ---------------------------------------------------------------------------


class TestProperty21ContentVersioning:
    """Property 21: Content versioning preservation.

    For any content article that is updated, the previous version SHALL be
    preserved in article_versions with the previous version_number, and the
    article's version field SHALL be incremented by exactly one.

    **Validates: Requirements 11.7, 15.3**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        new_title=_titles,
        new_content=_markdown_content,
    )
    async def test_update_preserves_previous_version(
        self,
        new_title: str,
        new_content: str,
        db_session,
    ):
        """Updating an article must snapshot the old version and increment version by 1.

        **Validates: Requirements 11.7**
        """
        service = ContentService(db_session)

        # Setup: create module and article
        module = await _create_module(db_session)
        article = await _create_article(
            db_session, module.id, title="Original Title", content="Original Body"
        )
        await db_session.commit()

        original_version = article.version
        original_title = article.title
        original_content = article.content_markdown

        # Act: update the article
        update_data = ArticleUpdate(title=new_title, content_markdown=new_content)
        updated = await service.update_article(article_id=article.id, data=update_data)
        await db_session.commit()

        # Assert: version incremented by exactly 1
        assert updated.version == original_version + 1, (
            f"Expected version {original_version + 1}, got {updated.version}"
        )

        # Assert: previous version preserved in article_versions
        from sqlalchemy import select

        stmt = (
            select(ArticleVersion)
            .where(ArticleVersion.article_id == article.id)
            .where(ArticleVersion.version_number == original_version)
        )
        result = await db_session.execute(stmt)
        version_snapshot = result.scalar_one_or_none()

        assert version_snapshot is not None, (
            f"Version {original_version} snapshot not found in article_versions"
        )
        assert version_snapshot.title == original_title
        assert version_snapshot.content_markdown == original_content

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        num_updates=st.integers(min_value=2, max_value=5),
    )
    async def test_multiple_updates_preserve_all_versions(
        self,
        num_updates: int,
        db_session,
    ):
        """Multiple sequential updates must each create a version snapshot.

        **Validates: Requirements 11.7**
        """
        service = ContentService(db_session)

        module = await _create_module(db_session)
        article = await _create_article(
            db_session, module.id, title="V1 Title", content="V1 Content"
        )
        await db_session.commit()

        for i in range(num_updates):
            update_data = ArticleUpdate(
                title=f"V{i + 2} Title",
                content_markdown=f"V{i + 2} Content",
            )
            article = await service.update_article(
                article_id=article.id, data=update_data
            )
            await db_session.commit()

        # Final version should be 1 + num_updates
        assert article.version == 1 + num_updates

        # All previous versions should exist
        from sqlalchemy import select, func

        count_stmt = select(func.count()).where(
            ArticleVersion.article_id == article.id
        )
        version_count = (await db_session.execute(count_stmt)).scalar_one()
        assert version_count == num_updates, (
            f"Expected {num_updates} version snapshots, got {version_count}"
        )


# ---------------------------------------------------------------------------
# Property 19: Role-based access control
# ---------------------------------------------------------------------------


class TestProperty19RoleBasedAccessControl:
    """Property 19: Role-based access control.

    For any API endpoint with role restrictions and any user whose role does
    not meet the requirement, the request SHALL receive a 403 response.
    Users with the required role SHALL be granted access.

    **Validates: Requirements 14.3, 21.1**
    """

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        role=st.sampled_from([UserRole.USER, UserRole.PREMIUM]),
    )
    async def test_non_admin_rejected_on_create_article(
        self,
        role: str,
        db_session,
        override_get_db,
    ):
        """Non-admin users must receive 403 when creating articles.

        **Validates: Requirements 14.3**
        """
        # Create a user with the given non-admin role
        user = User(
            email=f"user-{uuid.uuid4().hex[:8]}@test.com",
            hashed_password="hashed",
            auth_provider="email",
            role=role,
        )
        db_session.add(user)
        await db_session.commit()

        token = _make_token(user.id, role=role)

        from src.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Create a module first (needed for valid payload)
            module = await _create_module(db_session)
            await db_session.commit()

            response = await client.post(
                "/api/v1/content/articles",
                json={
                    "module_id": str(module.id),
                    "title": "Test Article",
                    "content_markdown": "Body text",
                },
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 403, (
            f"Expected 403 for role '{role}', got {response.status_code}"
        )

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        role=st.sampled_from([UserRole.USER, UserRole.PREMIUM]),
    )
    async def test_non_admin_rejected_on_update_article(
        self,
        role: str,
        db_session,
        override_get_db,
    ):
        """Non-admin users must receive 403 when updating articles.

        **Validates: Requirements 14.3**
        """
        user = User(
            email=f"user-{uuid.uuid4().hex[:8]}@test.com",
            hashed_password="hashed",
            auth_provider="email",
            role=role,
        )
        db_session.add(user)
        await db_session.commit()

        token = _make_token(user.id, role=role)

        from src.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.put(
                f"/api/v1/content/articles/{uuid.uuid4()}",
                json={"title": "Updated Title"},
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 403, (
            f"Expected 403 for role '{role}', got {response.status_code}"
        )

    @pytest.mark.asyncio
    @_fixture_settings
    @given(
        role=st.sampled_from([UserRole.USER, UserRole.PREMIUM]),
    )
    async def test_non_admin_rejected_on_publish_article(
        self,
        role: str,
        db_session,
        override_get_db,
    ):
        """Non-admin users must receive 403 when publishing articles.

        **Validates: Requirements 14.3**
        """
        user = User(
            email=f"user-{uuid.uuid4().hex[:8]}@test.com",
            hashed_password="hashed",
            auth_provider="email",
            role=role,
        )
        db_session.add(user)
        await db_session.commit()

        token = _make_token(user.id, role=role)

        from src.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                f"/api/v1/content/articles/{uuid.uuid4()}/publish",
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 403, (
            f"Expected 403 for role '{role}', got {response.status_code}"
        )

    @pytest.mark.asyncio
    async def test_admin_allowed_on_create_article(
        self,
        db_session,
        override_get_db,
    ):
        """Admin users must be granted access to create articles.

        **Validates: Requirements 14.3**
        """
        admin = User(
            email=f"admin-{uuid.uuid4().hex[:8]}@test.com",
            hashed_password="hashed",
            auth_provider="email",
            role=UserRole.ADMIN,
        )
        db_session.add(admin)
        await db_session.commit()

        module = await _create_module(db_session)
        await db_session.commit()

        token = _make_token(admin.id, role=UserRole.ADMIN)

        from src.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/content/articles",
                json={
                    "module_id": str(module.id),
                    "title": "Admin Article",
                    "content_markdown": "Content",
                },
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 201, (
            f"Expected 201 for admin, got {response.status_code}: {response.text}"
        )
