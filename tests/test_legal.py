"""Tests for legal endpoints — privacy policy and terms of service."""

from __future__ import annotations

import pytest


class TestLegalEndpoints:
    @pytest.mark.asyncio
    async def test_privacy_returns_html(self, client, override_get_db):
        r = await client.get("/privacy")
        assert r.status_code == 200
        assert "text/html" in r.headers["content-type"]

    @pytest.mark.asyncio
    async def test_privacy_contains_expected_content(self, client, override_get_db):
        r = await client.get("/privacy")
        assert "privacy" in r.text.lower()

    @pytest.mark.asyncio
    async def test_terms_returns_html(self, client, override_get_db):
        r = await client.get("/terms")
        assert r.status_code == 200
        assert "text/html" in r.headers["content-type"]

    @pytest.mark.asyncio
    async def test_terms_contains_expected_content(self, client, override_get_db):
        r = await client.get("/terms")
        assert "terms" in r.text.lower()

    @pytest.mark.asyncio
    async def test_no_auth_required_privacy(self, client, override_get_db):
        r = await client.get("/privacy")
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_no_auth_required_terms(self, client, override_get_db):
        r = await client.get("/terms")
        assert r.status_code == 200
