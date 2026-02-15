"""Application settings loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

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

    # App
    APP_NAME: str = "HypertrophyOS"
    DEBUG: bool = False
    CORS_ORIGINS: list[str] = ["*"]


settings = Settings()
