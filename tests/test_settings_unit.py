"""Unit tests for Settings validation."""

import logging


from src.config.settings import Settings


DB_URL = "sqlite+aiosqlite:///test.db"


def test_weak_jwt_secret_warns_when_debug_false(caplog):
    """A JWT_SECRET shorter than 32 chars logs a warning when DEBUG=False."""
    with caplog.at_level(logging.WARNING, logger="src.config.settings"):
        s = Settings(
            JWT_SECRET="short",  # pragma: allowlist secret
            DEBUG=False,
            DATABASE_URL=DB_URL,
            CORS_ORIGINS="https://app.repwise.app",
            ALLOWED_HOSTS="api.repwise.app",
            ENVIRONMENT="production",
        )
    assert s is not None
    assert "JWT_SECRET" in caplog.text


def test_default_jwt_secret_warns_when_debug_false(caplog):
    """The default 'change-me-in-production' logs a warning when DEBUG=False."""
    with caplog.at_level(logging.WARNING, logger="src.config.settings"):
        s = Settings(
            JWT_SECRET="change-me-in-production",  # pragma: allowlist secret
            DEBUG=False,
            DATABASE_URL=DB_URL,
            CORS_ORIGINS="https://app.repwise.app",
            ALLOWED_HOSTS="api.repwise.app",
            ENVIRONMENT="production",
        )
    assert s is not None
    assert "JWT_SECRET" in caplog.text


def test_valid_jwt_secret_succeeds_when_debug_false():
    """A 64-char hex secret succeeds when DEBUG=False."""
    secret = "a" * 64
    s = Settings(
        JWT_SECRET=secret,
        DEBUG=False,
        DATABASE_URL=DB_URL,
        CORS_ORIGINS="https://app.repwise.app",
        ALLOWED_HOSTS="api.repwise.app",
    )
    assert s.JWT_SECRET == secret


def test_weak_secret_succeeds_when_debug_true():
    """A weak secret is allowed when ENVIRONMENT=development (dev mode bypass)."""
    s = Settings(JWT_SECRET="weak", DEBUG=True, ENVIRONMENT="development", DATABASE_URL=DB_URL)
    assert s.JWT_SECRET == "weak"
