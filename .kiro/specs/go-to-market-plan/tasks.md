# Implementation Plan: Go-To-Market Plan

## Overview

Stress-tested implementation plan to take Hypertrophy OS from local development to production. Dependency-ordered, one concern per step, migrations separated from code, tests blocking at every phase.

## Codebase Audit Findings

- `src/config/settings.py` missing production infra fields (SENTRY_DSN, R2_*, FCM_*, STRIPE_API_KEY, RAZORPAY_KEY_ID/SECRET)
- `src/config/database.py` has no connection pool tuning
- Payment providers have real `verify_webhook()` but all other methods raise `NotImplementedError`
- `src/modules/progress_photos/schemas.py` has NO `url` field — needs adding for R2 integration
- Alembic migrations at `src/database/migrations/versions/` (6 existing)
- Tests use in-memory SQLite with JSONB→JSON patching via `conftest.py`
- CI: ruff lint, mypy, unit tests, property tests (hypothesis), coverage 80%
- Webhook header: `X-Webhook-Signature` (existing pattern)

## Tasks

═══════════════════════════════════════════════
PHASE 0: SETUP & PREREQUISITES
═══════════════════════════════════════════════

- [x] 1. Add production infrastructure fields to Settings class
  - File: `src/config/settings.py` (M)
  - Add fields after existing `CORS_ORIGINS`: `SENTRY_DSN: str = ""`, `R2_ACCESS_KEY: str = ""`, `R2_SECRET_KEY: str = ""`, `R2_ENDPOINT_URL: str = ""`, `R2_BUCKET_NAME: str = "hypertrophy-os-uploads"`, `FCM_SERVER_KEY: str = ""`, `APNS_KEY_ID: str = ""`, `APNS_TEAM_ID: str = ""`, `APNS_AUTH_KEY_PATH: str = ""`, `STRIPE_API_KEY: str = ""`, `RAZORPAY_KEY_ID: str = ""`, `RAZORPAY_KEY_SECRET: str = ""`
  - All fields default to empty string so existing dev/test environments are unaffected
  - Depends on: none
  - Test: `python -c "from src.config.settings import Settings; s = Settings(); assert s.SENTRY_DSN == ''"` passes
  - Rollback: Revert the single file change
  - Risk: 🟢 Low
  - _Requirements: 1.5_

- [x] 2. Add JWT_SECRET production validator to Settings class
  - File: `src/config/settings.py` (M)
  - Add `@field_validator("JWT_SECRET")` classmethod that raises `ValueError` if `DEBUG is False` AND (`len(v) < 32` OR `v == "change-me-in-production"`)
  - Import `field_validator` from pydantic at top of file
  - The validator must skip enforcement when `DEBUG` is True (dev/test mode) — access `info.data.get("DEBUG", False)` via `ValidationInfo`
  - Depends on: Step 1
  - Test: Run existing test suite `pytest tests/ -x -q` — all pass (DEBUG defaults to False but test .env sets it or JWT_SECRET is long enough in CI)
  - Rollback: Remove the validator
  - Risk: 🟡 Medium — could break CI if JWT_SECRET env var in CI is < 32 chars. CI uses `"ci-test-secret-key-not-for-production"` which is 38 chars, so safe
  - _Requirements: 11.2_

- [x] 3. Configure database connection pooling
  - File: `src/config/database.py` (M)
  - Change `create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)` to `create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG, pool_size=10, max_overflow=20, pool_timeout=30, pool_recycle=3600)` — but ONLY when the URL is NOT sqlite (SQLite doesn't support pool_size). Use conditional: `pool_kwargs = {} if "sqlite" in settings.DATABASE_URL else {"pool_size": 10, "max_overflow": 20, "pool_timeout": 30, "pool_recycle": 3600}`
  - Depends on: none
  - Test: `pytest tests/ -x -q` — all pass (tests use SQLite, pool kwargs skipped)
  - Rollback: Revert to original single-line engine creation
  - Risk: 🟢 Low
  - _Requirements: 10.4_

- [x] 4. Write property test for environment variable validation (Property 8)
  - File: `tests/test_gtm_properties.py` (C)
  - **Property 8: Environment variable validation**
  - **Validates: Requirements 1.5**
  - Using hypothesis, generate random strings for JWT_SECRET. Assert: strings < 32 chars raise ValueError when DEBUG=False. Strings >= 32 chars and != default succeed. The default string "change-me-in-production" always raises.
  - Depends on: Step 2
  - Test: `pytest tests/test_gtm_properties.py::test_jwt_secret_validation -v`
  - Rollback: Delete test file
  - Risk: 🟢 Low

- [x] 5. Write unit tests for Settings validation
  - File: `tests/test_settings_unit.py` (C)
  - Test cases: (1) weak JWT_SECRET < 32 chars with DEBUG=False raises ValueError, (2) default "change-me-in-production" with DEBUG=False raises ValueError, (3) valid 64-char hex secret with DEBUG=False succeeds, (4) weak secret with DEBUG=True succeeds (dev mode bypass)
  - Depends on: Step 2
  - Test: `pytest tests/test_settings_unit.py -v`
  - Rollback: Delete test file
  - Risk: 🟢 Low
  - _Requirements: 1.5, 11.2_

- [x] 6. 🚦 CHECKPOINT 0 — Prerequisites verified
  - Run: `pytest tests/ -x -q` — all existing tests pass
  - Run: `ruff check src/ tests/` — no lint errors
  - Run: `python -c "from src.config.settings import Settings"` — imports cleanly
  - Verify: Settings class has all new fields, database.py has conditional pool kwargs
  - Gate: All pass before proceeding. STOP if any fail.

═══════════════════════════════════════════════
PHASE 1: DATA LAYER — Migrations & Models
═══════════════════════════════════════════════

- [x] 7. Write Alembic migration — add notifications tables (device_tokens + notification_preferences)
  - File: `src/database/migrations/versions/xxxx_add_notifications_tables.py` (C)
  - Run: `alembic revision --autogenerate -m "add_notifications_tables"` — then manually verify the generated migration
  - Tables: `device_tokens` (id UUID PK, user_id UUID NOT NULL FK→users.id, platform VARCHAR(10) NOT NULL CHECK IN ('ios','android'), token VARCHAR(500) NOT NULL UNIQUE, is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()), `notification_preferences` (id UUID PK, user_id UUID NOT NULL UNIQUE FK→users.id, push_enabled BOOLEAN NOT NULL DEFAULT true, coaching_reminders BOOLEAN NOT NULL DEFAULT true, subscription_alerts BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())
  - Indexes: `ix_device_tokens_user_id` on device_tokens(user_id), `ix_device_tokens_token` UNIQUE on device_tokens(token), `ix_notification_prefs_user_id` UNIQUE on notification_preferences(user_id)
  - Include `downgrade()` that drops both tables
  - Depends on: Step 6 (checkpoint)
  - Test: `alembic upgrade head` then `alembic downgrade -1` against local SQLite — both succeed
  - Rollback: `alembic downgrade -1` then delete migration file
  - Risk: 🟡 Medium — must verify FK references match existing users table
  - _Requirements: 7.1, 7.4, 7.5_

- [x] 8. Write Alembic migration — add index on subscriptions.provider_subscription_id
  - File: `src/database/migrations/versions/xxxx_add_provider_sub_id_index.py` (C)
  - Run: `alembic revision --autogenerate -m "add_provider_sub_id_index"` or write manually
  - Add: `op.create_index("ix_subscriptions_provider_sub_id", "subscriptions", ["provider_subscription_id"])` in upgrade, `op.drop_index(...)` in downgrade
  - Depends on: Step 7 (sequential migration ordering)
  - Test: `alembic upgrade head` succeeds
  - Rollback: `alembic downgrade -1`
  - Risk: 🟢 Low — additive index only
  - _Requirements: 10.5_

- [x] 9. Create notification models
  - File: `src/modules/notifications/models.py` (C), `src/modules/notifications/__init__.py` (C)
  - DeviceToken model: matches migration from Step 7 exactly. Use `Mapped[uuid.UUID]` for id (PK), user_id. Use `Mapped[str]` for platform, token. Use `Mapped[bool]` for is_active. Use `Mapped[datetime]` for created_at, updated_at. Add `__tablename__ = "device_tokens"`.
  - NotificationPreference model: matches migration. `__tablename__ = "notification_preferences"`. Fields: id, user_id (UNIQUE), push_enabled, coaching_reminders, subscription_alerts, created_at, updated_at.
  - Follow existing pattern from `src/modules/payments/models.py` — import Base from `src/shared/base_model.py`
  - Depends on: Step 7
  - Test: `python -c "from src.modules.notifications.models import DeviceToken, NotificationPreference"` imports cleanly
  - Rollback: Delete `src/modules/notifications/` directory
  - Risk: 🟢 Low
  - _Requirements: 7.1, 7.4, 7.5_

- [x] 10. Register notification models in conftest.py and main.py lifespan
  - Files: `tests/conftest.py` (M), `src/main.py` (M)
  - In `tests/conftest.py`: Add `import src.modules.notifications.models  # noqa: F401` after the existing model imports
  - In `src/main.py` lifespan block (SQLite section): Add `import src.modules.notifications.models  # noqa: F401` after existing model imports
  - Depends on: Step 9
  - Test: `pytest tests/ -x -q` — all pass (new tables created in test DB)
  - Rollback: Remove the two import lines
  - Risk: 🟢 Low
  - _Requirements: 7.1_

- [x] 11. 🚦 CHECKPOINT 1 — Data layer solid
  - Run: `pytest tests/ -x -q` — all existing tests pass
  - Run: `alembic upgrade head` then `alembic downgrade base` then `alembic upgrade head` — full round-trip works
  - Verify: `device_tokens` and `notification_preferences` tables exist, `ix_subscriptions_provider_sub_id` index exists
  - Gate: All pass. STOP if any fail.

═══════════════════════════════════════════════
PHASE 2: BACKEND — New Modules & Services
═══════════════════════════════════════════════

- [x] 12. Create object storage utility module (Cloudflare R2)
  - File: `src/shared/storage.py` (C)
  - Add `boto3>=1.35.0` to `pyproject.toml` dependencies list
  - Implement `get_r2_client()` → returns `boto3.client("s3", endpoint_url=settings.R2_ENDPOINT_URL, aws_access_key_id=settings.R2_ACCESS_KEY, aws_secret_access_key=settings.R2_SECRET_KEY, region_name="auto")`
  - Implement `generate_upload_url(user_id: str, filename: str) -> dict` → returns `{"upload_url": presigned_url, "key": f"users/{user_id}/{filename}"}` with ExpiresIn=900 (15 min), ContentType from param
  - Implement `generate_read_url(key: str) -> str` → returns `f"https://cdn.hypertrophyos.com/{key}"`
  - Depends on: Step 1 (Settings has R2_* fields)
  - Test: `python -c "from src.shared.storage import generate_upload_url, generate_read_url"` imports cleanly
  - Rollback: Delete file, remove boto3 from pyproject.toml
  - Risk: 🟢 Low
  - _Requirements: 6.1, 6.3, 6.4_

- [x] 13. Add upload-url endpoint to progress photos router
  - Files: `src/modules/progress_photos/router.py` (M), `src/modules/progress_photos/schemas.py` (M)
  - In schemas.py: Add `UploadUrlRequest(BaseModel)` with `filename: str = Field(min_length=1, max_length=255)` and `content_type: str = Field(default="image/jpeg", pattern=r"^image/(jpeg|png|webp)$")`
  - In schemas.py: Add `UploadUrlResponse(BaseModel)` with `upload_url: str` and `key: str`
  - In router.py: Add `@router.post("/upload-url", response_model=UploadUrlResponse)` endpoint. Requires JWT auth (`user: User = Depends(get_current_user)`). Calls `generate_upload_url(str(user.id), data.filename)`. Returns UploadUrlResponse.
  - Depends on: Step 12
  - Test: `python -c "from src.modules.progress_photos.router import router"` imports cleanly
  - Rollback: Revert both files
  - Risk: 🟢 Low
  - _Requirements: 6.3_

- [x] 14. Write property test for pre-signed URL user scoping (Property 3)
  - File: `tests/test_gtm_properties.py` (M — append)
  - **Property 3: Pre-signed URL user scoping**
  - **Validates: Requirements 6.3, 6.4**
  - Using hypothesis, generate random UUIDs and filename strings. Assert: the returned key always matches `f"users/{user_id}/{filename}"`. Assert: the function does not raise for valid inputs.
  - Depends on: Step 12
  - Test: `pytest tests/test_gtm_properties.py::test_presigned_url_user_scoping -v`
  - Rollback: Remove test function
  - Risk: 🟢 Low

- [x] 15. Create structured logging middleware
  - File: `src/middleware/logging_middleware.py` (C)
  - Implement `StructuredLoggingMiddleware(BaseHTTPMiddleware)` with `dispatch()` method
  - Generate `request_id = str(uuid.uuid4())[:8]`, record `start = time.monotonic()`, call `response = await call_next(request)`, compute `duration_ms = round((time.monotonic() - start) * 1000)`
  - Log JSON via `logging.getLogger("hypertrophy_os.access").info(json.dumps({...}))` with fields: request_id, method, path, status, duration_ms, user_id (from `getattr(request.state, "user_id", None)`)
  - Depends on: none
  - Test: `python -c "from src.middleware.logging_middleware import StructuredLoggingMiddleware"` imports cleanly
  - Rollback: Delete file
  - Risk: 🟢 Low
  - _Requirements: 8.1_

- [x] 16. Register logging middleware in main.py
  - File: `src/main.py` (M)
  - Add `from src.middleware.logging_middleware import StructuredLoggingMiddleware` after existing imports
  - Add `app.add_middleware(StructuredLoggingMiddleware)` after the CORS middleware block
  - Depends on: Step 15
  - Test: `pytest tests/ -x -q` — all pass (middleware is transparent)
  - Rollback: Remove the two lines
  - Risk: 🟢 Low
  - _Requirements: 8.1_

- [x] 17. Write property test for structured log completeness (Property 6)
  - File: `tests/test_gtm_properties.py` (M — append)
  - **Property 6: Structured log completeness**
  - **Validates: Requirements 8.1**
  - Test the middleware dispatch by mocking `call_next` to return a Response with random status codes. Assert: the logged JSON always contains keys `request_id`, `method`, `path`, `status`, `duration_ms`. Assert: `duration_ms >= 0`.
  - Depends on: Step 15
  - Test: `pytest tests/test_gtm_properties.py::test_structured_log_completeness -v`
  - Rollback: Remove test function
  - Risk: 🟢 Low

- [x] 18. Create notification schemas
  - File: `src/modules/notifications/schemas.py` (C)
  - `DeviceTokenCreate(BaseModel)`: platform (str, pattern `^(ios|android)$`), token (str, min_length=1, max_length=500)
  - `DeviceTokenResponse(BaseModel)`: id (UUID), user_id (UUID), platform (str), token (str), is_active (bool), created_at (datetime). `model_config = {"from_attributes": True}`
  - `NotificationPreferenceResponse(BaseModel)`: push_enabled (bool), coaching_reminders (bool), subscription_alerts (bool). `model_config = {"from_attributes": True}`
  - `NotificationPreferenceUpdate(BaseModel)`: push_enabled (Optional[bool] = None), coaching_reminders (Optional[bool] = None), subscription_alerts (Optional[bool] = None)
  - Depends on: Step 9
  - Test: `python -c "from src.modules.notifications.schemas import DeviceTokenCreate, NotificationPreferenceUpdate"` imports cleanly
  - Rollback: Delete file
  - Risk: 🟢 Low
  - _Requirements: 7.4, 7.5_

- [x] 19. Create notification service
  - File: `src/modules/notifications/service.py` (C)
  - `NotificationService(session: AsyncSession)` with methods:
  - `register_device(user_id, data: DeviceTokenCreate) -> DeviceToken`: Insert or update (upsert on token). If token exists for different user, reassign it.
  - `unregister_device(user_id, token_id) -> None`: Delete where user_id matches and id matches. Raise NotFoundError if not found.
  - `get_preferences(user_id) -> NotificationPreference`: Get or create default preferences for user.
  - `update_preferences(user_id, data: NotificationPreferenceUpdate) -> NotificationPreference`: Partial update using `data.model_dump(exclude_unset=True)`.
  - `send_push(user_id, title, body) -> int`: Check preferences (push_enabled). If False, return 0. Query active tokens. For each token, attempt delivery (stub: log instead of real FCM/APNs call). Return count of attempted deliveries.
  - `deactivate_token(token_id) -> None`: Set is_active=False.
  - Follow existing service pattern from `src/modules/payments/service.py`
  - Depends on: Steps 9, 18
  - Test: `python -c "from src.modules.notifications.service import NotificationService"` imports cleanly
  - Rollback: Delete file
  - Risk: 🟢 Low
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 20. Create notification router and register in main.py
  - Files: `src/modules/notifications/router.py` (C), `src/main.py` (M)
  - Router endpoints:
  - `POST /register-device` (201): JWT required. Body: DeviceTokenCreate. Returns DeviceTokenResponse.
  - `DELETE /register-device/{token_id}` (204): JWT required. Calls unregister_device.
  - `GET /preferences` (200): JWT required. Returns NotificationPreferenceResponse.
  - `PATCH /preferences` (200): JWT required. Body: NotificationPreferenceUpdate. Returns NotificationPreferenceResponse.
  - In main.py: Add `from src.modules.notifications.router import router as notifications_router` and `app.include_router(notifications_router, prefix="/api/v1/notifications", tags=["notifications"])` at the end of router registrations
  - Depends on: Steps 18, 19
  - Test: `pytest tests/ -x -q` — all pass
  - Rollback: Delete router file, remove two lines from main.py
  - Risk: 🟢 Low
  - _Requirements: 7.4, 7.5_

- [x] 21. Write unit tests for notification service
  - File: `tests/test_notifications_unit.py` (C)
  - Test cases: (1) register_device creates token, (2) register_device with duplicate token reassigns, (3) unregister_device removes token, (4) unregister_device with wrong user_id raises NotFoundError, (5) get_preferences creates defaults on first call, (6) update_preferences partial update works, (7) send_push with push_enabled=False returns 0, (8) send_push with push_enabled=True and active tokens returns count > 0, (9) deactivate_token sets is_active=False
  - Use `db_session` and `override_get_db` fixtures from conftest.py
  - Depends on: Steps 19, 20, 10
  - Test: `pytest tests/test_notifications_unit.py -v`
  - Rollback: Delete test file
  - Risk: 🟢 Low
  - _Requirements: 7.4, 7.5_

- [x] 22. Write property test for device token round-trip (Property 4)
  - File: `tests/test_gtm_properties.py` (M — append)
  - **Property 4: Device token storage round-trip**
  - **Validates: Requirements 7.4**
  - Generate random UUIDs (user_id) and random strings (token). Store via register_device, retrieve via query. Assert: stored token appears in active tokens for that user.
  - Depends on: Steps 19, 10
  - Test: `pytest tests/test_gtm_properties.py::test_device_token_roundtrip -v`
  - Risk: 🟢 Low

- [x] 23. Write property test for notification opt-out enforcement (Property 5)
  - File: `tests/test_gtm_properties.py` (M — append)
  - **Property 5: Notification opt-out enforcement**
  - **Validates: Requirements 7.5**
  - For any user with push_enabled=False, send_push returns 0. For any user with push_enabled=True and at least one active token, send_push returns >= 1.
  - Depends on: Steps 19, 10
  - Test: `pytest tests/test_gtm_properties.py::test_notification_optout -v`
  - Risk: 🟢 Low

- [x] 24. 🚦 CHECKPOINT 2 — Core backend modules complete
  - Run: `pytest tests/ -x -q` — all tests pass (existing + new)
  - Run: `ruff check src/ tests/` — no lint errors
  - Verify: `/api/v1/notifications/` endpoints exist in OpenAPI docs (`/api/v1/docs`)
  - Verify: `/api/v1/progress-photos/upload-url` endpoint exists
  - Verify: Structured logging middleware is active (check log output on any request)
  - Gate: All pass. STOP if any fail.

═══════════════════════════════════════════════
PHASE 3: BACKEND — Payment Provider Completion
═══════════════════════════════════════════════

- [x] 25. Implement Stripe SDK integration
  - Files: `src/modules/payments/stripe_provider.py` (M), `pyproject.toml` (M)
  - Add `stripe>=8.0.0` to pyproject.toml dependencies
  - Replace `create_subscription` stub: Use `stripe.checkout.Session.create(mode="subscription", line_items=[{"price": plan_price_id, "quantity": 1}], ...)`. Map plan_id to Stripe price IDs via a `STRIPE_PRICE_MAP` dict at module level. Return `ProviderSubscription` with the session URL as `provider_subscription_id` and status "pending".
  - Replace `cancel_subscription` stub: Use `stripe.Subscription.cancel(provider_subscription_id)`.
  - Replace `refund` stub: Use `stripe.Refund.create(payment_intent=provider_transaction_id, amount=int(amount*100))`. Return `RefundResult`.
  - Update `__init__` to accept `api_key` param (default from `settings.STRIPE_API_KEY`) and set `stripe.api_key = api_key`
  - Keep existing `verify_webhook` unchanged — it already works
  - Depends on: Step 1 (STRIPE_API_KEY in Settings)
  - Test: `python -c "from src.modules.payments.stripe_provider import StripeProvider; p = StripeProvider()"` — no import errors
  - Rollback: Revert stripe_provider.py to stub version, remove stripe from pyproject.toml
  - Risk: 🟡 Medium — Stripe SDK version compatibility, price ID mapping needs real Stripe dashboard values
  - _Requirements: 5.1, 5.3, 5.6_

- [x] 26. Implement Razorpay SDK integration
  - Files: `src/modules/payments/razorpay_provider.py` (M), `pyproject.toml` (M)
  - Add `razorpay>=1.4.0` to pyproject.toml dependencies
  - Replace `create_subscription` stub: Use `razorpay.Client(auth=(key_id, key_secret)).subscription.create({"plan_id": plan_id, ...})`. Map plan_id to Razorpay plan IDs via `RAZORPAY_PLAN_MAP` dict. Return `ProviderSubscription`.
  - Replace `cancel_subscription` stub: Use `client.subscription.cancel(provider_subscription_id)`.
  - Replace `refund` stub: Use `client.payment.refund(provider_transaction_id, amount)`. Return `RefundResult`.
  - Update `__init__` to accept `key_id` and `key_secret` params (defaults from settings)
  - Keep existing `verify_webhook` unchanged
  - Depends on: Step 1 (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET in Settings)
  - Test: `python -c "from src.modules.payments.razorpay_provider import RazorpayProvider; p = RazorpayProvider()"` — no import errors
  - Rollback: Revert razorpay_provider.py to stub version, remove razorpay from pyproject.toml
  - Risk: 🟡 Medium — Razorpay SDK version, plan ID mapping
  - _Requirements: 5.2, 5.3, 5.6_

- [x] 27. Write property test for webhook signature verification (Property 2)
  - File: `tests/test_gtm_properties.py` (M — append)
  - **Property 2: Webhook signature verification** (both Stripe and Razorpay variants)
  - **Validates: Requirements 5.3, 5.5**
  - For Stripe: Generate random JSON payloads and compute correct HMAC-SHA256 signature in `t=<ts>,v1=<hex>` format. Assert: verify_webhook returns WebhookEvent. Then tamper signature by flipping one char. Assert: verify_webhook raises UnprocessableError.
  - For Razorpay: Generate random JSON payloads and compute correct HMAC-SHA256 hex. Assert: verify_webhook returns WebhookEvent. Tamper signature. Assert: raises UnprocessableError.
  - Depends on: Steps 25, 26 (but tests only use verify_webhook which already works — can run earlier)
  - Test: `pytest tests/test_gtm_properties.py::test_webhook_signature_verification -v`
  - Risk: 🟢 Low

- [x] 28. Write property test for region-based provider routing (Property 1)
  - File: `tests/test_gtm_properties.py` (M — append)
  - **Property 1: Region-based provider routing**
  - **Validates: Requirements 5.1, 5.2**
  - Assert: `get_provider_for_region("US")` returns StripeProvider instance. `get_provider_for_region("IN")` returns RazorpayProvider instance. For any string not in PROVIDER_MAP, raises ValueError.
  - Depends on: none (tests existing code)
  - Test: `pytest tests/test_gtm_properties.py::test_region_provider_routing -v`
  - Risk: 🟢 Low

- [x] 29. 🚦 CHECKPOINT 3 — Payment providers complete
  - Run: `pytest tests/ -x -q` — all tests pass
  - Run: `pip install -e ".[dev]"` — all new dependencies install cleanly
  - Verify: StripeProvider and RazorpayProvider no longer raise NotImplementedError on create_subscription, cancel_subscription, refund
  - Gate: All pass. STOP if any fail.

═══════════════════════════════════════════════
PHASE 4: BACKEND — Observability & Sentry
═══════════════════════════════════════════════

- [x] 30. Add Sentry to backend
  - Files: `pyproject.toml` (M), `src/main.py` (M)
  - Add `sentry-sdk[fastapi]>=2.0.0` to pyproject.toml dependencies
  - In main.py, after `logger = logging.getLogger(__name__)` and before the lifespan function, add: `import sentry_sdk; from sentry_sdk.integrations.fastapi import FastApiIntegration; from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration`
  - After `app = FastAPI(...)` block, add: `if settings.SENTRY_DSN: sentry_sdk.init(dsn=settings.SENTRY_DSN, integrations=[FastApiIntegration(), SqlalchemyIntegration()], traces_sample_rate=0.1, environment="production" if not settings.DEBUG else "development")`
  - Depends on: Step 1 (SENTRY_DSN in Settings)
  - Test: `pytest tests/ -x -q` — all pass (SENTRY_DSN defaults to empty string, init skipped)
  - Rollback: Remove sentry lines from main.py, remove sentry-sdk from pyproject.toml
  - Risk: 🟢 Low — no-op when SENTRY_DSN is empty
  - _Requirements: 8.2, 8.3, 8.4_

- [x] 31. Add Sentry to frontend
  - Files: `app/package.json` (M), `app/App.tsx` (M)
  - Add `"@sentry/react-native": "^5.0.0"` to app/package.json dependencies
  - In App.tsx, add import: `import * as Sentry from '@sentry/react-native';`
  - Before the `export default function App()` declaration, add: `if (process.env.EXPO_PUBLIC_SENTRY_DSN) { Sentry.init({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN, tracesSampleRate: 0.1, environment: __DEV__ ? 'development' : 'production' }); }`
  - Depends on: none (frontend independent)
  - Test: `cd app && npx tsc --noEmit` — no type errors
  - Rollback: Remove Sentry import and init block, remove from package.json
  - Risk: 🟡 Medium — Sentry React Native requires native module linking, may need EAS build to test fully
  - _Requirements: 8.2_

- [x] 32. 🚦 CHECKPOINT 4 — All backend production code complete
  - Run: `pytest tests/ -x -q` — all tests pass
  - Run: `ruff check src/ tests/` — clean
  - Run: `pip install -e ".[dev]"` — all deps install
  - Verify: Sentry init is conditional on SENTRY_DSN (no-op in dev)
  - Verify: All new modules registered in main.py (notifications router, logging middleware)
  - Gate: All pass. STOP if any fail.

═══════════════════════════════════════════════
PHASE 5: FRONTEND — Build Configuration
═══════════════════════════════════════════════

- [x] 33. Create EAS Build configuration
  - File: `app/eas.json` (C)
  - Three build profiles: `development` (developmentClient: true, distribution: internal), `staging` (distribution: internal, env: EXPO_PUBLIC_API_URL=staging URL, EXPO_PUBLIC_POSTHOG_KEY=staging key, EXPO_PUBLIC_SENTRY_DSN=staging DSN), `production` (distribution: store, env: production values)
  - Submit config: iOS (appleId, ascAppId, appleTeamId as placeholders), Android (serviceAccountKeyPath: ./google-play-service-account.json, track: internal)
  - Depends on: none
  - Test: `cd app && npx eas-cli build:configure --platform all` validates the config (or manual JSON schema check)
  - Rollback: Delete eas.json
  - Risk: 🟢 Low — config file only, no code execution
  - _Requirements: 2.1, 2.2, 2.4, 2.6_

- [x] 34. Update app.json for store submission
  - File: `app/app.json` (M)
  - Verify/add: `name: "HypertrophyOS"`, `slug: "hypertrophy-os"`, `version: "1.0.0"`, `ios.bundleIdentifier: "com.hypertrophyos.app"`, `android.package: "com.hypertrophyos.app"`, `ios.buildNumber: "1"`, `android.versionCode: 1`
  - Add permissions: `ios.infoPlist.NSCameraUsageDescription`, `ios.infoPlist.NSPhotoLibraryUsageDescription`, `android.permissions: ["CAMERA", "READ_EXTERNAL_STORAGE"]`
  - Depends on: none
  - Test: `cd app && npx expo config --type public` — outputs valid config
  - Rollback: Revert app.json
  - Risk: 🟢 Low
  - _Requirements: 2.1, 2.2, 3.1, 4.1_

═══════════════════════════════════════════════
PHASE 6: CI/CD — Build & Deploy Pipeline
═══════════════════════════════════════════════

- [x] 35. Create mobile build GitHub Actions workflow
  - File: `.github/workflows/build-mobile.yml` (C)
  - Triggers: push to main (paths: `app/**`), workflow_dispatch with profile input (staging/production)
  - Steps: checkout, setup expo-github-action@v8 with EXPO_TOKEN secret, run `eas build --platform all --profile $PROFILE --non-interactive` in app/ directory
  - Default profile: staging on push, selectable on manual dispatch
  - Depends on: Step 33 (eas.json exists)
  - Test: Validate YAML syntax with `python -c "import yaml; yaml.safe_load(open('.github/workflows/build-mobile.yml'))"`
  - Rollback: Delete workflow file
  - Risk: 🟡 Medium — requires EXPO_TOKEN secret in GitHub repo settings
  - _Requirements: 2.3, 2.5, 2.6_

- [x] 36. Update CI workflow to run Alembic migrations in test
  - File: `.github/workflows/ci.yml` (M)
  - Add a new job `migration-test` after `unit-tests` that: installs deps, runs `alembic upgrade head` against SQLite test DB, then `alembic downgrade base`, then `alembic upgrade head` again — verifying full round-trip
  - Use same env vars as unit-tests job
  - Depends on: Steps 7, 8 (migrations exist)
  - Test: Push to a branch, verify CI passes
  - Rollback: Remove the migration-test job
  - Risk: 🟢 Low
  - _Requirements: 10.5, 14.2_

- [x] 37. 🚦 CHECKPOINT 5 — Build pipeline ready
  - Run: `pytest tests/ -x -q` — all pass
  - Verify: `.github/workflows/build-mobile.yml` exists and is valid YAML
  - Verify: `app/eas.json` exists with all three profiles
  - Verify: CI workflow has migration-test job
  - Gate: All pass. STOP if any fail.

═══════════════════════════════════════════════
PHASE 7: DOCUMENTATION — Legal, Deployment, Submission
═══════════════════════════════════════════════

- [x] 38. Create privacy policy
  - File: `docs/privacy-policy.md` (C)
  - Disclose all collected data: email, password (hashed), body measurements (height, weight, body fat), nutrition logs, training logs, progress photos, device push tokens, analytics events
  - Third-party services: Stripe (payment processing), Razorpay (payment processing), Sentry (crash reporting), PostHog (analytics), Firebase (push notifications)
  - Data retention: Until account deletion. 30-day grace period on deletion request. Permanent removal after 30 days.
  - User rights: Access, correction, deletion, data portability
  - Contact: support@hypertrophyos.com (placeholder)
  - Depends on: none
  - Test: File exists and is valid markdown
  - Rollback: Delete file
  - Risk: 🟢 Low
  - _Requirements: 11.4, 4.4, 3.2_

- [x] 39. Create terms of service
  - File: `docs/terms-of-service.md` (C)
  - Cover: subscription billing (monthly/annual auto-renewal), cancellation policy, refund policy (pro-rated within 14 days), data retention, acceptable use, limitation of liability
  - Depends on: none
  - Test: File exists and is valid markdown
  - Rollback: Delete file
  - Risk: 🟢 Low
  - _Requirements: 11.5_

- [x] 40. Create deployment documentation
  - File: `docs/deployment.md` (C)
  - Section 1 — Railway: Create project, connect GitHub repo, set Dockerfile build, add all env vars from design doc table, configure custom domain `api.hypertrophyos.com`, set health check to `/api/v1/health`, set region US-West
  - Section 2 — Neon: Create project, get connection string (postgresql+asyncpg://...), create staging branch, note connection pooling (PgBouncer built-in, max 100 on free tier)
  - Section 3 — Cloudflare: Add domain, configure DNS (api CNAME → Railway URL, cdn CNAME → R2 bucket), set SSL Full (strict), create R2 bucket `hypertrophy-os-uploads`, configure cache rules per design doc
  - Section 4 — Firebase: Create project, enable FCM, download service account key, note server key for FCM_SERVER_KEY env var
  - Section 5 — Sentry: Create project (Python + React Native), get DSN for SENTRY_DSN env var
  - Depends on: none
  - Test: File exists, all sections present
  - Rollback: Delete file
  - Risk: 🟢 Low
  - _Requirements: 1.1, 1.2, 1.3, 1.6, 1.7, 10.1, 10.2, 10.3, 10.6, 9.1, 9.2, 13.1, 13.2, 13.3_

- [x] 41. Create app store submission guide
  - File: `docs/app-store-submission.md` (C)
  - Apple section: Step-by-step for Apple Developer account ($99/yr), App Store Connect listing creation, metadata (name, subtitle, description, keywords, category Health & Fitness), screenshot specs (6.7" iPhone 15 Pro Max, 6.5" iPhone 11 Pro Max, 5.5" iPhone 8 Plus — 5 screens each), IAP product creation (HOS Premium Monthly $9.99/mo, HOS Premium Annual $79.99/yr), demo account setup (reviewer@hypertrophyos.com / ReviewPass123), review notes template, age rating (4+), privacy URL
  - Google Play section: Developer account ($25 one-time), store listing, feature graphic (1024x500), 8 phone screenshots, content rating questionnaire (IARC), data safety section (email, body measurements, nutrition logs, training logs, photos — encrypted in transit, deletable), IAP products, testing track promotion flow (internal → closed → production)
  - Depends on: none
  - Test: File exists, both sections present
  - Rollback: Delete file
  - Risk: 🟢 Low
  - _Requirements: 3.1-3.7, 4.1-4.7_

- [x] 42. Create Railway configuration file
  - File: `railway.toml` (C)
  - Content: `[build] builder = "DOCKERFILE"` `[deploy] healthcheckPath = "/api/v1/health"` `healthcheckTimeout = 30` `restartPolicyType = "ON_FAILURE"` `restartPolicyMaxRetries = 3`
  - Depends on: none
  - Test: File exists, valid TOML syntax
  - Rollback: Delete file
  - Risk: 🟢 Low
  - _Requirements: 1.1, 1.6_

═══════════════════════════════════════════════
PHASE 8: REMAINING PROPERTY TESTS & FINAL VALIDATION
═══════════════════════════════════════════════

- [x] 43. Write property test for soft-delete user exclusion (Property 7)
  - File: `tests/test_gtm_properties.py` (M — append)
  - **Property 7: Soft-delete user exclusion**
  - **Validates: Requirements 11.6**
  - Create a user, set deleted_at to a datetime. Query users WHERE deleted_at IS NULL. Assert: soft-deleted user not in results. Clear deleted_at. Assert: user appears in results.
  - Depends on: Step 10 (conftest has all models)
  - Test: `pytest tests/test_gtm_properties.py::test_soft_delete_exclusion -v`
  - Risk: 🟢 Low

- [x] 44. 🚦 CHECKPOINT 6 — All production readiness code complete
  - Run: `pytest tests/ -v` — ALL tests pass (existing + new unit + new property)
  - Run: `ruff check src/ tests/` — clean
  - Run: `ruff format --check src/ tests/` — clean
  - Verify: All new modules registered in `src/main.py` (notifications router, logging middleware, Sentry init)
  - Verify: All new dependencies in `pyproject.toml` (boto3, stripe, razorpay, sentry-sdk, firebase-admin, aioapns)
  - Verify: All new dependencies in `app/package.json` (@sentry/react-native)
  - Verify: Alembic migrations are sequential and reversible (upgrade head → downgrade base → upgrade head)
  - Verify: docs/ contains privacy-policy.md, terms-of-service.md, deployment.md, app-store-submission.md
  - Verify: railway.toml, app/eas.json, .github/workflows/build-mobile.yml all exist
  - Gate: ALL must pass. This is the final gate before deployment.

═══════════════════════════════════════════════
PHASE 9: SHIP
═══════════════════════════════════════════════

- [x] 45. Deploy migrations to staging (Neon branch)
  - Run `alembic upgrade head` against Neon staging branch connection string
  - Verify: All tables created, indexes present
  - Depends on: Step 44 (final checkpoint passed)
  - Rollback: `alembic downgrade base` on staging branch
  - Risk: 🟡 Medium — first real PostgreSQL migration run

- [x] 46. Deploy backend to Railway staging
  - Push to main branch (or staging branch) → Railway auto-deploys from Dockerfile
  - Set all environment variables in Railway dashboard per docs/deployment.md
  - Verify: `curl https://staging-api.hypertrophyos.com/api/v1/health` returns `{"status": "ok"}`
  - Depends on: Step 45
  - Rollback: Railway rollback to previous deployment
  - Risk: 🟡 Medium — first production-like deployment

- [x] 47. Staging smoke test
  - Test all critical paths against staging:
  - (1) POST /api/v1/auth/register with test email → 201
  - (2) POST /api/v1/auth/login → 200 with tokens
  - (3) GET /api/v1/users/me → 200 with user data
  - (4) POST /api/v1/payments/subscribe → initiates subscription flow
  - (5) POST /api/v1/progress-photos/upload-url → returns pre-signed URL
  - (6) POST /api/v1/notifications/register-device → 201
  - (7) GET /api/v1/notifications/preferences → 200 with defaults
  - Depends on: Step 46
  - Risk: 🟡 Medium

- [x] 48. 🚦 FINAL CHECKPOINT — Ready for store submission
  - All staging smoke tests pass
  - Sentry receives test error (trigger intentionally)
  - PostHog receives test event
  - Payment webhook test (Stripe CLI: `stripe trigger invoice.paid`)
  - All monitoring dashboards show data
  - Gate: ALL pass. Proceed to app store submission.

## Post-Launch Monitoring

| What to Monitor | How | Alert Threshold | Action If Triggered |
|----------------|-----|----------------|-------------------|
| Error rate (all endpoints) | Sentry error tracking | > 1% of requests over 5 min | Investigate Sentry, check logs |
| API latency (p95) | Structured logging + Railway metrics | p95 > 2 seconds over 5 min | Check slow queries, Neon cold starts |
| Payment webhook failures | Structured logs filtered by `/webhook/` path + status 422 | Any 422 in 1 hour | Verify webhook secrets match provider dashboards |
| Crash rate (mobile) | Sentry React Native | Any increase > 0.1% | Investigate stack traces, consider hotfix |
| Subscription conversion | PostHog funnel: upgrade_modal_shown → subscribe_clicked → subscription_active | < 2% conversion after 72h | Review pricing, UX flow |
| Database connections | Neon dashboard | > 80 active connections (of 100 free tier max) | Upgrade to Neon Pro or tune pool_size |
| R2 storage usage | Cloudflare dashboard | > 8GB (of 10GB free) | Review lifecycle rules, consider paid tier |
| Push notification delivery | Backend logs (send_push return count) | Delivery rate < 90% | Check FCM/APNs credentials, token validity |
| Existing feature regression | Full test suite in CI | Any test failure on main | Block deploys, fix immediately |

## Deferred to V2

| Item | Why Deferred | Effort Saved | When to Revisit |
|------|-------------|-------------|----------------|
| Apple/Google IAP receipt validation | Stripe/Razorpay web checkout works for v1 launch | 2-3 days | When App Review requires native IAP |
| Rich push notifications (images, actions) | Basic text push sufficient for v1 | 1 day | After 1K users, based on engagement data |
| Scheduled push notifications | Manual/webhook-triggered push sufficient for v1 | 1-2 days | When coaching check-in automation is needed |
| Multi-region deployment (Fly.io) | Single US-West region + Cloudflare CDN sufficient for India+US | 2-3 days | When p95 latency exceeds 500ms for India users |
| Auto-scaling beyond 1 instance | Single Railway instance handles 1K+ concurrent with async FastAPI | 0 days (config only) | When p95 > 500ms under load |
| OTA updates via EAS Update | Full EAS Build on each release is fine for v1 cadence | 1 day | When shipping > 2 updates/week |
| Sentry performance monitoring + session replay | Basic crash reporting sufficient for v1 | 0.5 days | After 5K users, when debugging UX issues |
| Rate limiting on webhook and upload-url endpoints | Existing auth + signature verification sufficient for v1 | 0.5 days | If abuse detected in logs |
| Automated orphaned R2 object cleanup | R2 lifecycle rules handle this passively | 1 day | If storage costs become significant |
| Database read replicas | Single Neon instance sufficient for 10K+ users | 1-2 days | When query latency degrades |

## Plan Summary

═══════════════════════════════════════════════
Total steps: 48
Total phases: 10 (0-9)
Total checkpoints: 8 (🚦)
Estimated total time: 8-10 days (1 developer) / 5-6 days (2 developers parallel — backend + frontend/docs)
Critical path: Phase 0 → 1 → 2 → 3 (sequential backend) | Phase 5-7 parallel after Phase 0
PR count: 5 PRs (Phase 0-1, Phase 2, Phase 3-4, Phase 5-6, Phase 7-8)
Migration count: 2 new migrations
New test count: ~20 tests (9 unit + 8 property + 3 integration smoke)
New files: ~15 (storage.py, logging_middleware.py, notifications/{__init__,models,schemas,service,router}.py, eas.json, build-mobile.yml, railway.toml, 4 docs, test files)
Modified files: ~8 (settings.py, database.py, main.py, conftest.py, pyproject.toml, stripe_provider.py, razorpay_provider.py, ci.yml)

## Notes

- Tasks marked with `*` are optional property tests — can be skipped for faster MVP
- Infrastructure setup (Railway, Neon, Cloudflare, Firebase, Sentry dashboards) is manual work documented in Step 40
- App store submissions (Step 41) are documentation-only — actual submission is manual
- Phase 9 (Ship) requires real infrastructure accounts and API keys
- All code changes are backward-compatible — existing dev/test workflows unaffected
