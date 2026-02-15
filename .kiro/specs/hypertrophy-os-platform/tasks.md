# Implementation Plan: HypertrophyOS Platform

## Overview

Modular implementation following MVP phasing. Backend in Python/FastAPI, frontend in React Native/TypeScript. Each task builds incrementally, with property tests validating correctness at each step. A judge agent reviews all outputs before merge.

## Tasks

- [x] 1. Project scaffolding and core infrastructure
  - [x] 1.1 Initialize Python backend project with FastAPI, SQLAlchemy 2.0, Alembic, Pydantic, and pytest
    - Create `pyproject.toml` with dependencies: fastapi, uvicorn, sqlalchemy[asyncio], asyncpg, alembic, pydantic, pydantic-settings, python-jose, passlib, httpx, hypothesis
    - Create `src/main.py` with FastAPI app, CORS, and router registration
    - Create `src/config/settings.py` with Pydantic Settings for env vars (DATABASE_URL, JWT_SECRET, etc.)
    - Create `src/config/database.py` with async SQLAlchemy engine and session factory
    - Create `src/shared/types.py`, `src/shared/errors.py`, `src/shared/pagination.py`
    - Create `tests/conftest.py` with test database fixtures
    - _Requirements: 14.1, 14.6_

  - [x] 1.2 Initialize React Native project with Expo and TypeScript
    - Create Expo project with TypeScript template
    - Create `app/theme/tokens.ts` with all design tokens (colors, elevation, typography, spacing, radius, motion)
    - Create `app/services/api.ts` with Axios client configured for /api/v1/ base URL
    - Create `app/store/index.ts` with Zustand store skeleton
    - _Requirements: 18.1, 18.5, 18.6, 18.7, 18.8_

  - [x] 1.3 Create Alembic migration infrastructure and base database models
    - Initialize Alembic with async PostgreSQL support
    - Create `src/shared/soft_delete.py` with SoftDeleteMixin (deleted_at column, query filter)
    - Create `src/shared/audit.py` with AuditLogMixin
    - Create base SQLAlchemy model with UUID primary key, created_at, updated_at
    - _Requirements: 15.1, 15.2, 16.4_

- [x] 2. Authentication module
  - [x] 2.1 Implement auth models, schemas, and service
    - Create `src/modules/auth/models.py` with Users table (id, email, auth_provider, auth_provider_id, role, timestamps, deleted_at)
    - Create `src/modules/auth/schemas.py` with Pydantic models: RegisterRequest, LoginRequest, AuthTokensResponse, OAuthCallbackRequest
    - Create `src/modules/auth/service.py` with register_email, login_email, login_oauth, refresh_token, logout
    - Implement JWT token generation with configurable expiration (access: 15min, refresh: 7 days)
    - Implement password hashing with passlib/bcrypt
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 16.1, 16.2_

  - [x] 2.2 Implement auth routes and middleware
    - Create `src/modules/auth/router.py` with POST /register, POST /login, POST /oauth/{provider}, POST /refresh, POST /logout
    - Create `src/middleware/authenticate.py` — FastAPI dependency that verifies JWT and attaches user to request
    - Create `src/middleware/authorize.py` — role-based access dependency (user, premium, admin)
    - Create `src/middleware/rate_limiter.py` — per-user rate limiting for login attempts
    - _Requirements: 1.6, 1.7, 1.8, 14.2, 14.3, 14.7, 16.6_

  - [x] 2.3 Write property tests for auth module
    - **Property 4: Input validation rejects invalid data** — generate random invalid registration inputs (missing email, short password, malformed email) and verify rejection
    - **Property 18: JWT authentication enforcement** — generate random requests with/without valid JWTs and verify 401/200 responses
    - **Property 24: Token expiration configuration** — generate tokens and verify exp claims match configured TTLs
    - **Validates: Requirements 1.6, 14.2, 16.1, 16.2**

  - [x] 2.4 Write unit tests for auth module
    - Test email registration happy path
    - Test duplicate email registration (409 conflict)
    - Test login with correct and incorrect credentials
    - Test token refresh with valid and expired refresh tokens
    - Test rate limiting after threshold exceeded
    - _Requirements: 1.1, 1.4, 1.5, 1.7, 1.8_

- [x] 3. Checkpoint — Auth module complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. User profile and metrics module
  - [x] 4.1 Implement user models and service
    - Create models: UserProfiles, UserMetrics, BodyweightLogs, UserGoals
    - Create Pydantic schemas for all CRUD operations
    - Create `src/modules/user/service.py` with get_profile, update_profile, log_metrics, log_bodyweight, set_goals, get_metrics_history, get_bodyweight_history
    - Implement pagination for history endpoints
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 4.2 Implement user routes
    - Create `src/modules/user/router.py` with GET/PUT /profile, POST /metrics, POST /bodyweight, PUT /goals, GET /metrics/history, GET /bodyweight/history
    - All endpoints require JWT authentication
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 14.2, 14.4_

  - [x] 4.3 Write property tests for user module
    - **Property 7: History append-only invariant** — add N random metrics entries and verify count increases by exactly N, previous entries unchanged
    - **Property 20: Pagination metadata correctness** — query with random page/limit and verify total_count and item count constraints
    - **Validates: Requirements 2.5, 14.4**

- [x] 5. Nutrition tracking module
  - [x] 5.1 Implement nutrition models and service
    - Create NutritionEntries model with JSONB micro_nutrients column
    - Create Pydantic schemas: NutritionEntryCreate (with validation: calories >= 0, protein_g >= 0, etc.), NutritionEntryUpdate, NutritionEntryResponse
    - Create `src/modules/nutrition/service.py` with create_entry, get_entries (date range + pagination), update_entry, soft_delete_entry
    - Implement audit trail on update (store previous values in audit_logs)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 5.2 Implement nutrition routes
    - Create `src/modules/nutrition/router.py` with POST /entries, GET /entries, PUT /entries/{id}, DELETE /entries/{id}
    - All endpoints require JWT authentication
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 14.2_

  - [x] 5.3 Write property tests for nutrition module
    - **Property 1: Entity creation round-trip** — create random nutrition entries and verify retrieval returns equivalent data
    - **Property 2: Date range filtering correctness** — create entries across random dates, query a random range, verify all results are within range
    - **Property 3: Soft deletion preserves records** — soft-delete random entries, verify they exist in DB with deleted_at but don't appear in list queries
    - **Validates: Requirements 3.1, 3.2, 3.4**

- [x] 6. Custom meals and favorites module
  - [x] 6.1 Implement meal library models and service
    - Create CustomMeals and MealFavorites models
    - Create Pydantic schemas for custom meal CRUD and favorites
    - Create `src/modules/meals/service.py` with create_custom_meal, update_custom_meal, delete_custom_meal, add_favorite, remove_favorite, get_favorites, get_custom_meals
    - Implement pre-fill logic: when logging from a favorite/custom meal, copy values to NutritionEntryCreate
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 6.2 Implement meal library routes
    - Create `src/modules/meals/router.py` with CRUD endpoints for custom meals and favorites
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.3 Write property tests for meal library
    - **Property 8: Favorites round-trip** — add random meals to favorites, verify they appear in favorites list; remove and verify exclusion
    - **Property 23: Custom meal edit isolation** — create a custom meal, log entries from it, edit the meal, verify logged entries are unchanged
    - **Property 28: Meal pre-fill correctness** — select random custom meals, verify pre-filled entry values match source
    - **Validates: Requirements 4.2, 4.3, 4.5, 4.4**

- [x] 7. Training session module
  - [x] 7.1 Implement training models and service
    - Create TrainingSessions model with JSONB exercises and metadata columns
    - Create Pydantic schemas with nested ExerciseEntry and SetEntry validation
    - Create `src/modules/training/service.py` with create_session, get_sessions, update_session, soft_delete_session
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 7.2 Implement training routes
    - Create `src/modules/training/router.py` with POST /sessions, GET /sessions, PUT /sessions/{id}, DELETE /sessions/{id}
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 7.3 Write property tests for training module
    - **Property 1: Entity creation round-trip** — create random training sessions and verify retrieval
    - **Property 2: Date range filtering correctness** — verify date range queries return only matching sessions
    - **Validates: Requirements 6.1, 6.2**

- [x] 8. Checkpoint — Core data modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Adaptive engine module
  - [x] 9.1 Implement adaptive engine pure functions
    - Create `src/modules/adaptive/engine.py` with pure function `compute_snapshot(input: AdaptiveInput) -> AdaptiveOutput`
    - Implement BMR calculation (Mifflin-St Jeor)
    - Implement TDEE calculation with activity multipliers
    - Implement EMA smoothing for bodyweight trend (α = 2/(N+1), N=7)
    - Implement adaptive adjustment with clamping [-300, +300] kcal/day
    - Implement macro distribution (protein by goal type, fat 25%, carbs remainder)
    - Handle edge cases: < 7 days data (use simple average), negative carbs (floor at 50g), extreme fluctuations (>2kg/day excluded)
    - _Requirements: 7.1, 7.3, 7.5_

  - [x] 9.2 Implement adaptive models, service, and routes
    - Create AdaptiveSnapshots model
    - Create `src/modules/adaptive/service.py` with generate_snapshot, get_snapshots, check_recalculation_needed
    - Create `src/modules/adaptive/router.py` with POST /snapshots, GET /snapshots, GET /recalculation-status
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 9.3 Write property tests for adaptive engine
    - **Property 9: Adaptive engine determinism** — generate random valid AdaptiveInputs, call compute_snapshot twice, verify identical outputs
    - **Property 29: Adaptive engine output safety bounds** — generate random inputs, verify target_calories >= 1200, carbs >= 50, adjustment clamped to [-300, +300]
    - **Validates: Requirements 7.5, 7.1**

- [x] 10. Payment and subscription module
  - [x] 10.1 Implement payment provider interface and implementations
    - Create `src/modules/payments/provider_interface.py` with abstract PaymentProvider class
    - Create `src/modules/payments/stripe_provider.py` implementing PaymentProvider for Stripe
    - Create `src/modules/payments/razorpay_provider.py` implementing PaymentProvider for Razorpay
    - Implement PROVIDER_MAP for region-based routing
    - _Requirements: 10.1, 10.6, 10.7_

  - [x] 10.2 Implement subscription models, service, and state machine
    - Create Subscriptions and PaymentTransactions models
    - Create `src/modules/payments/service.py` with initiate_subscription, handle_webhook, cancel_subscription, request_refund, get_subscription_status
    - Implement subscription state machine with valid transitions only
    - Create `src/middleware/freemium_gate.py` — require_premium dependency
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.8, 10.9_

  - [x] 10.3 Implement payment routes
    - Create `src/modules/payments/router.py` with POST /subscribe, POST /webhook/{provider}, POST /cancel, POST /refund, GET /status
    - Webhook endpoints are public (no JWT) but verify signatures
    - _Requirements: 10.1, 10.3, 10.4, 10.5_

  - [x] 10.4 Write property tests for payment module
    - **Property 10: Payment provider routing by region** — generate random regions, verify correct provider selected from PROVIDER_MAP
    - **Property 11: Webhook signature verification** — generate random payloads with valid/invalid signatures, verify accept/reject behavior
    - **Property 30: Subscription state machine validity** — generate random status transitions, verify only valid ones succeed
    - **Property 6: Freemium gating enforcement** — generate random users with/without active subscriptions, verify premium endpoint access
    - **Validates: Requirements 10.1, 10.3, 10.9**

- [x] 11. Checkpoint — Core backend complete (auth, data, adaptive, payments)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Audit logging and feature flags
  - [x] 12.1 Implement audit logging middleware
    - Create AuditLogs model
    - Create `src/middleware/audit_logger.py` that logs all state-changing operations (create, update, delete) with user_id, action, entity_type, entity_id, changes, timestamp
    - Wire audit middleware into all existing routes
    - _Requirements: 16.4_

  - [x] 12.2 Implement feature flag service
    - Create FeatureFlags model
    - Create `src/modules/feature_flags/service.py` with is_feature_enabled, get_flags, set_flag
    - Implement in-memory cache with TTL for flag lookups
    - _Requirements: 15.6_

  - [x] 12.3 Write property tests for audit and feature flags
    - **Property 17: Audit logging completeness** — perform random CRUD operations, verify audit_logs entries exist for each
    - **Property 25: Feature flag toggling** — toggle random flags, verify is_feature_enabled returns correct values
    - **Validates: Requirements 16.4, 15.6**

- [x] 13. Content and educational module
  - [x] 13.1 Implement content models and service
    - Create ContentModules, ContentArticles, ArticleVersions, ArticleFavorites models
    - Create `src/modules/content/service.py` with get_articles (paginated, filterable by category/tags), get_article, create_article, update_article (with versioning), publish_article, save_to_favorites, remove_favorite, get_favorite_articles
    - Implement premium content gating (check user subscription before returning premium articles)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

  - [x] 13.2 Implement content routes
    - Create `src/modules/content/router.py` with GET /articles, GET /articles/{id}, POST /articles (admin), PUT /articles/{id} (admin), POST /articles/{id}/publish (admin), POST /articles/{id}/favorite, DELETE /articles/{id}/favorite, GET /favorites
    - _Requirements: 11.1, 11.2, 11.4, 11.8, 21.1_

  - [x] 13.3 Write property tests for content module
    - **Property 21: Content versioning preservation** — update random articles, verify previous versions preserved and version number incremented by 1
    - **Property 19: Role-based access control** — verify admin-only endpoints reject non-admin users with 403
    - **Validates: Requirements 11.7, 14.3**

- [x] 14. Food database module
  - [x] 14.1 Implement food database models and service
    - Create FoodItems and RecipeIngredients models
    - Create `src/modules/food_database/service.py` with search (fuzzy text via pg_trgm), get_by_id, get_recipe, create_food_item (admin), update_food_item (admin)
    - Implement recipe nutritional aggregation (sum of ingredients scaled by quantity/serving_size)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 14.2 Implement food database routes and seed data
    - Create `src/modules/food_database/router.py` with GET /search, GET /{id}, GET /recipes/{id}, POST / (admin), PUT /{id} (admin)
    - Create seed migration with initial curated Indian food items (200+ items)
    - _Requirements: 5.1, 5.2, 21.2_

  - [x] 14.3 Write property tests for food database
    - **Property 15: Recipe nutritional aggregation** — generate random recipes with ingredients, verify total nutrition equals sum of scaled ingredients
    - **Property 16: Food search relevance** — generate random search queries, verify all results contain the query term
    - **Validates: Requirements 5.3, 5.2**

- [x] 15. Coaching module
  - [x] 15.1 Implement coaching models and service
    - Create CoachingRequests, CoachingSessions, CoachProfiles models
    - Create `src/modules/coaching/service.py` with submit_request (premium-gated), approve_request, complete_session, get_requests, get_sessions, upload_document
    - Implement status transition validation (pending → approved/rejected/cancelled, scheduled → in_progress → completed/cancelled)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [x] 15.2 Implement coaching routes
    - Create `src/modules/coaching/router.py` with POST /requests (premium), GET /requests, POST /requests/{id}/approve (admin), POST /sessions/{id}/complete, POST /sessions/{id}/documents
    - _Requirements: 12.1, 12.2, 12.3, 12.5_

  - [x] 15.3 Write property tests for coaching module
    - **Property 22: Coaching status transitions** — generate random status transition attempts, verify only valid transitions succeed
    - **Validates: Requirements 12.2, 12.3**

- [x] 16. Checkpoint — All Phase 1+2 backend modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Health reports and dietary analysis modules
  - [x] 17.1 Implement health report models and service
    - Create HealthReports and MarkerReferenceRanges models
    - Create `src/modules/health_reports/service.py` with upload_report, get_reports, get_report_detail, cross_reference_nutrition, get_sample_reports
    - Implement `flag_markers` pure function: classify each marker as low/normal/high against reference ranges
    - Seed marker_reference_ranges with standard health markers (cholesterol, LDL, HDL, triglycerides, hemoglobin, vitamin D, B12, iron)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 17.2 Implement dietary analysis service
    - Create `src/modules/dietary_analysis/service.py` with analyze_trends, identify_gaps, get_recommendations
    - Implement `compute_daily_averages` pure function
    - Implement `detect_gaps` pure function (compare averages against recommended daily values)
    - Seed recommended daily values reference table
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 17.3 Implement health report and dietary analysis routes
    - Create routes for both modules, health reports premium-gated
    - _Requirements: 8.1, 8.4, 9.1, 9.5_

  - [x] 17.4 Write property tests for health and dietary modules
    - **Property 12: Health marker flagging correctness** — generate random marker values and ranges, verify correct low/normal/high classification
    - **Property 13: Dietary analysis average computation** — generate random nutrition entries over N days, verify averages equal sum/N
    - **Property 14: Nutritional gap detection** — generate random averages and recommended values, verify gaps are correctly identified with deficit percentages
    - **Property 27: Health report chronological ordering** — create reports with random dates, verify retrieval is chronologically ordered
    - **Validates: Requirements 8.2, 9.2, 9.3, 8.4**

- [x] 18. Founder story and community modules
  - [x] 18.1 Implement founder and community modules
    - Create FounderContent model
    - Create `src/modules/founder/service.py` with get_content, update_content (admin)
    - Create `src/modules/community/router.py` returning admin-configurable community links (Telegram, email)
    - Create routes: GET /founder, PUT /founder (admin), GET /community
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 21.3_

  - [x] 18.2 Write property test for founder module
    - **Property 26: Founder content update round-trip** — update content, verify next read returns updated values
    - **Validates: Requirements 13.2**

- [x] 19. User account deletion
  - [x] 19.1 Implement account deletion service and route
    - Add DELETE /account endpoint with 30-day grace period logic
    - Implement deactivation (set deleted_at, cancel subscription)
    - Implement reactivation within grace period
    - Implement permanent deletion job (background task)
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5_

- [x] 20. JSON serialization round-trip and API validation
  - [x] 20.1 Implement global request/response validation
    - Create `src/middleware/validate.py` with Pydantic-based request validation
    - Create global exception handler returning ApiError format
    - Ensure all routes use Pydantic response models
    - _Requirements: 20.1, 20.2, 20.4_

  - [x] 20.2 Write property test for JSON round-trip
    - **Property 5: JSON serialization round-trip** — generate random valid Pydantic response models, serialize to JSON, deserialize, verify equivalence
    - **Validates: Requirements 20.3**

- [x] 21. Checkpoint — Full backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 22. React Native — Navigation shell and design system
  - [x] 22.1 Implement bottom tab navigation and theme
    - Create `app/navigation/BottomTabNavigator.tsx` with Dashboard, Logs, Analytics, Learn, Profile tabs
    - Create `app/components/common/Card.tsx` using design tokens (surface bg, subtle border, 12px radius, 16-24px padding)
    - Create `app/components/common/Button.tsx` (primary with gradient, secondary with border)
    - Create `app/components/premium/PremiumBadge.tsx` (gold accent #D4AF37)
    - Create `app/components/premium/UpgradeBanner.tsx` and `UpgradeModal.tsx`
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8_

- [x] 23. React Native — Auth screens
  - [x] 23.1 Implement auth screens
    - Create Login screen with email/password form and Google/Apple OAuth buttons
    - Create Register screen with email/password form
    - Implement token storage (SecureStore) and auto-refresh
    - Wire API client with JWT interceptor
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 24. React Native — Dashboard and Logs screens
  - [x] 24.1 Implement Dashboard screen
    - KPI cards: today's calories, protein, weight trend (using design tokens, tabular numerals)
    - Quick-log buttons for nutrition and training
    - Adaptive target display
    - _Requirements: 18.1_

  - [x] 24.2 Implement Logs screen
    - Date-grouped nutrition entries with expandable cards
    - Training session list with exercise details
    - Add/edit/delete nutrition entries
    - Add/edit/delete training sessions
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.1, 6.2_

- [x] 25. React Native — Learn screen
  - [x] 25.1 Implement Learn section
    - Articles list view with category filter pills
    - Article detail page with Markdown rendering, YouTube embeds, estimated read time
    - Scroll progress indicator
    - Save to favorites with visual confirmation
    - Premium lock indicator on gated articles
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [x] 26. React Native — Analytics screen
  - [x] 26.1 Implement Analytics screen
    - Bodyweight trend chart (line chart with EMA overlay)
    - Nutrition trend charts (calories, protein, carbs, fat over time)
    - Adaptive target vs actual comparison
    - Dietary gap summary (premium users)
    - Use restrained chart colors from design tokens (blue for calories, green for positive, red for negative, amber for warning)
    - _Requirements: 9.1, 9.4, 18.1_

- [x] 27. React Native — Profile and remaining screens
  - [x] 27.1 Implement Profile screen
    - User profile display and edit
    - Subscription status and upgrade flow
    - Metrics history charts
    - Account deletion option
    - _Requirements: 2.1, 10.9, 22.1_

  - [x] 27.2 Implement Coaching screen (premium)
    - Coaching request form
    - Request and session history
    - Document upload
    - _Requirements: 12.1, 12.5_

  - [x] 27.3 Implement Health Reports screen (premium)
    - Report upload form
    - Report history with marker flags
    - Nutrition correlation display
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 27.4 Implement Founder Story and Community screens
    - Founder story page with timeline, narrative, media gallery
    - Community links (Telegram, email)
    - _Requirements: 13.1, 13.3, 13.5, 13.6_

- [x] 28. Analytics integration
  - [x] 28.1 Implement PostHog analytics tracking
    - Create `src/modules/analytics/service.py` with track_event, track_page_view
    - Wire analytics events: user.registered, user.logged_in, subscription.created, article.read, coaching.requested, feature.used
    - Add PostHog React Native SDK to mobile app
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

- [x] 29. CI/CD and deployment configuration
  - [x] 29.1 Set up GitHub Actions CI pipeline
    - Create `.github/workflows/ci.yml` with: lint (ruff), type check (mypy), unit tests (pytest), property tests (hypothesis), coverage check (>80%)
    - Create `Dockerfile` for backend
    - Create Railway deployment config
    - _Requirements: 14.1_

- [x] 30. Final checkpoint — Full platform complete
  - Ensure all tests pass across backend and frontend, ask the user if questions arise.
  - Run judge agent checklist against all modules.

## Notes

- All tasks including tests are required for comprehensive validation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The judge agent reviews all completed tasks before merge
