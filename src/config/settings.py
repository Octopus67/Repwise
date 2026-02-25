"""Application settings loaded from environment variables."""

from pydantic import field_validator, ValidationInfo
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_NAME: str = "HypertrophyOS"
    DEBUG: bool = False
    CORS_ORIGINS: list[str] = ["*"]

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://localhost:5432/hypertrophy_os"

    # JWT
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Rate limiting
    LOGIN_RATE_LIMIT_THRESHOLD: int = 5
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = 900

    # Payment providers
    STRIPE_WEBHOOK_SECRET: str = "whsec_test_secret"
    RAZORPAY_WEBHOOK_SECRET: str = "rzp_test_secret"

    # USDA FoodData Central
    USDA_API_KEY: str = "DEMO_KEY"

    # Production infrastructure
    SENTRY_DSN: str = ""
    R2_ACCESS_KEY: str = ""
    R2_SECRET_KEY: str = ""
    R2_ENDPOINT_URL: str = ""
    R2_BUCKET_NAME: str = "hypertrophy-os-uploads"
    FCM_SERVER_KEY: str = ""
    APNS_KEY_ID: str = ""
    APNS_TEAM_ID: str = ""
    APNS_AUTH_KEY_PATH: str = ""
    STRIPE_API_KEY: str = ""
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    @field_validator("JWT_SECRET")
    @classmethod
    def validate_jwt_secret(cls, v: str, info: ValidationInfo) -> str:
        debug = info.data.get("DEBUG", False)
        if not debug and (len(v) < 32 or v == "change-me-in-production"):
            raise ValueError(
                "JWT_SECRET must be at least 32 characters and not the default value in production"
            )
        return v


settings = Settings()
