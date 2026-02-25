"""Unit tests for Settings validation."""

import pytest
from pydantic import ValidationError

from src.config.settings import Settings


DB_URL = "sqlite+aiosqlite:///test.db"


def test_weak_jwt_secret_raises_when_debug_false():
    """A JWT_SECRET shorter than 32 chars raises ValueError when DEBUG=False."""
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(JWT_SECRET="short", DEBUG=False, DATABASE_URL=DB_URL)


def test_default_jwt_secret_raises_when_debug_false():
    """The default 'change-me-in-production' raises ValueError when DEBUG=False."""
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(JWT_SECRET="change-me-in-production", DEBUG=False, DATABASE_URL=DB_URL)


def test_valid_jwt_secret_succeeds_when_debug_false():
    """A 64-char hex secret succeeds when DEBUG=False."""
    secret = "a" * 64
    s = Settings(JWT_SECRET=secret, DEBUG=False, DATABASE_URL=DB_URL)
    assert s.JWT_SECRET == secret


def test_weak_secret_succeeds_when_debug_true():
    """A weak secret is allowed when DEBUG=True (dev mode bypass)."""
    s = Settings(JWT_SECRET="weak", DEBUG=True, DATABASE_URL=DB_URL)
    assert s.JWT_SECRET == "weak"
