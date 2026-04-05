"""Application settings loaded from environment variables."""

import json
import os
from pydantic import field_validator, ValidationInfo
from pydantic_settings import BaseSettings, SettingsConfigDict


def _parse_list(v: object) -> list[str]:
    """Parse a list field from env var — accepts JSON array or comma-separated string."""
    if isinstance(v, list):
        return v
    if isinstance(v, str):
        v = v.strip()
        if v.startswith("["):
            return json.loads(v)
        return [s.strip() for s in v.split(",") if s.strip()]
    return []


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_NAME: str = "Repwise"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")
    # Audit fix 6.11 — docs independent of DEBUG
    ENABLE_DOCS: bool = os.getenv("ENABLE_DOCS", "false").lower() in ("true", "1", "yes")
    CORS_ORIGINS: str = '["http://localhost:8081","http://localhost:19006"]'

    # Trusted hosts
    ALLOWED_HOSTS: str = '["localhost","127.0.0.1"]'

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS from JSON array or comma-separated string."""
        return _parse_list(self.CORS_ORIGINS)

    @property
    def allowed_hosts_list(self) -> list[str]:
        """Parse ALLOWED_HOSTS from JSON array or comma-separated string."""
        return _parse_list(self.ALLOWED_HOSTS)

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://localhost:5432/hypertrophy_os"

    # Audit fix 6.8 — JWT validation independent of DEBUG
    ENVIRONMENT: str = "production"

    # JWT
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Rate limiting
    LOGIN_RATE_LIMIT_THRESHOLD: int = 5
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = 900
    RATE_LIMIT_RPM: int = 100

    # Redis (empty = in-memory fallback)
    REDIS_URL: str = ""

    # OAuth
    GOOGLE_CLIENT_ID: str = ""
    APPLE_CLIENT_ID: str = ""  # Bundle ID, e.g. com.octopuslabs.repwise

    # Audit fix 9.6 — removed stale payment provider settings

    # USDA FoodData Central
    USDA_API_KEY: str = "DEMO_KEY"

    # Production infrastructure
    SENTRY_DSN: str = ""
    R2_ACCESS_KEY: str = ""
    R2_SECRET_KEY: str = ""
    R2_ENDPOINT_URL: str = ""
    R2_BUCKET_NAME: str = "repwise-uploads"
    CDN_BASE_URL: str = "https://cdn.repwise.app"
    EXPO_ACCESS_TOKEN: str = ""
    FCM_SERVER_KEY: str = ""
    APNS_KEY_ID: str = ""
    APNS_TEAM_ID: str = ""
    APNS_AUTH_KEY_PATH: str = ""
    # AWS SES
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    SES_REGION: str = "us-east-1"
    SES_SENDER_EMAIL: str = "noreply@repwise.app"

    # PostHog (analytics & feature flags)
    POSTHOG_PROJECT_API_KEY: str = ""
    POSTHOG_HOST: str = "https://us.i.posthog.com"

    # RevenueCat (iOS IAP / Google Play Billing)
    REVENUECAT_API_KEY: str = ""
    REVENUECAT_WEBHOOK_AUTH_KEY: str = ""
    REVENUECAT_API_URL: str = "https://api.revenuecat.com/v1"

    # Audit fix 10.11 — CAPTCHA gate for registration (requires external service)
    # TODO: Integrate with reCAPTCHA/hCaptcha provider
    REQUIRE_CAPTCHA: bool = False

    @field_validator("JWT_SECRET")
    @classmethod
    def validate_jwt_secret(cls, v: str, info: ValidationInfo) -> str:
        # Audit fix 6.8 — JWT validation independent of DEBUG
        env = info.data.get("ENVIRONMENT", "production")
        if env != "development" and (len(v) < 32 or v == "change-me-in-production"):
            raise ValueError(
                "JWT_SECRET must be at least 32 characters and not the default value in production"
            )
        return v

    @field_validator("CORS_ORIGINS")
    @classmethod
    def validate_cors_origins(cls, v: str, info: ValidationInfo) -> str:
        debug = info.data.get("DEBUG", False)
        origins = _parse_list(v)
        if not debug and all("localhost" in o or "127.0.0.1" in o for o in origins):
            raise ValueError(
                "CORS_ORIGINS must include production origins (not just localhost) when DEBUG=false"
            )
        return v

    @field_validator("ALLOWED_HOSTS")
    @classmethod
    def validate_allowed_hosts(cls, v: str, info: ValidationInfo) -> str:
        debug = info.data.get("DEBUG", False)
        hosts = _parse_list(v)
        if not debug and all(h in ("localhost", "127.0.0.1") for h in hosts):
            raise ValueError(
                "ALLOWED_HOSTS must include production hostnames when DEBUG=false"
            )
        return v


settings = Settings()
