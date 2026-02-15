# Implementation Plan: Achievement System

## Overview

Production-grade implementation plan for the Achievement System. Ordered by strict dependency chain — no step references anything not yet built. Each step includes risks, mitigations, and rollback notes. Testing checkpoints gate forward progress.

**Tech stack**: Python/FastAPI (backend), TypeScript/React Native (frontend), PostgreSQL, Hypothesis (property tests), pytest (unit tests), fast-check (frontend property tests).

**Rollback strategy**: Each backend step is behind the achievement module boundary. If any step fails, revert the files created/modified in that step. The achievement router is registered last (Step 10), so partial backend work is inert until wired. Frontend changes are additive components — revert by removing the component and its import.

**Monitoring (post-launch)**:
- Log `achievement.unlock` events with user_id, achievement_id, latency_ms
- Alert if achievement engine adds >200ms p99 to training/nutrition POST latency
- Alert if `achievement_progress` table grows >10x expected rate (indicates duplicate writes)
- Dashboard metric: unlock rate per achievement (detect broken thresholds)

## Tasks

- [x] 1. Create achievement module skeleton and definitions
  - [x] 1.1 Create `src/modules/achievements/__init__.py`, `definitions.py`, `exercise_aliases.py`
    - `definitions.py`: `AchievementCategory` StrEnum, `AchievementDef` frozen dataclass, `ACHIEVEMENT_REGISTRY` dict with all 23 achievement definitions (10 PR badges, 4 streaks, 5 volume, 3 nutrition)
    - `exercise_aliases.py`: `EXERCISE_ALIASES` dict mapping lowercase exercise name variants to canonical groups, `resolve_exercise_group(name: str) -> str | None` function
    - Risk: Alias list incomplete for user's actual exercise names. Mitigation: Start with the documented aliases; add a TODO for data-driven expansion post-launch.
    - Rollback: Delete `src/modules/achievements/` directory.
    - _Requirements: 1.2, 1.5_

  - [ ]* 1.2 Write property test for exercise alias resolution
    - **Property 2: Exercise alias resolution is case-insensitive and consistent**
    - **Validates: Requirements 1.5**

  - [ ]* 1.3 Write unit tests for achievement definitions registry
    - Verify all 23 definitions exist with correct categories, thresholds, and exercise groups
    - Verify no duplicate achievement IDs in registry
    - Verify all PR badge definitions have non-null exercise_group
    - _Requirements: 1.2_

- [x] 2. Create database models and schemas
  - [x] 2.1 Create `src/modules/achievements/models.py`
    - `UserAchievement` model: user_id (UUID, indexed), achievement_id (VARCHAR), unlocked_at (TIMESTAMP), trigger_data (JSONB nullable). Unique constraint on (user_id, achievement_id). Inherits SoftDeleteMixin, AuditLogMixin, Base.
    - `AchievementProgress` model: user_id (UUID, indexed), progress_type (VARCHAR), current_value (FLOAT, default 0), metadata_ (JSONB nullable). Unique constraint on (user_id, progress_type). Inherits Base.
    - Add model imports to `src/main.py` lifespan block for SQLite auto-create (follow existing pattern with `import src.modules.achievements.models  # noqa: F401`)
    - Risk: Unique constraint syntax differs between SQLite (dev) and PostgreSQL (prod). Mitigation: Use SQLAlchemy `UniqueConstraint` in `__table_args__` — works on both.
    - Rollback: Delete `models.py`, remove import from `src/main.py`.
    - _Requirements: 1.3, 3.4, 8.5_

  - [x] 2.2 Create `src/modules/achievements/schemas.py`
    - Pydantic schemas: `AchievementDefResponse`, `AchievementWithStatus`, `UserAchievementResponse`, `StreakResponse`, `NewlyUnlockedResponse`
    - Follow existing pattern from `src/modules/training/schemas.py` — use `model_config = {"from_attributes": True}` where needed
    - Risk: None significant — pure data classes.
    - Rollback: Delete `schemas.py`.
    - _Requirements: 8.4, 8.5_

  - [ ]* 2.3 Write property test for schema serialization round-trip
    - **Property 11: Achievement schema serialization round-trip**
    - **Validates: Requirements 8.5**

- [x] 3. Checkpoint — Verify foundation
  - Ensure all tests pass (`pytest tests/test_achievement_properties.py tests/test_achievement_unit.py -v`). Verify models create tables in SQLite dev mode by running the app. Ask the user if questions arise.

- [x] 4. Implement Achievement Engine core logic
  - [x] 4.1 Create `src/modules/achievements/engine.py` — PR badge detection and volume tracking
    - `AchievementEngine.__init__(self, session: AsyncSession)`
    - `_check_pr_badges(self, user_id, exercises) -> list[NewlyUnlockedResponse]`: For each exercise, resolve to exercise group via `resolve_exercise_group`. For each PR badge definition matching that group, check if any set weight >= threshold AND badge not already unlocked. If unlocking, create `UserAchievement` row with trigger_data.
    - `_update_volume(self, user_id, exercises) -> list[NewlyUnlockedResponse]`: Calculate session volume as sum(weight_kg * reps) across all sets. Upsert `AchievementProgress` row (progress_type="lifetime_volume"), incrementing current_value. Check each volume milestone threshold — unlock if crossed and not already unlocked.
    - `evaluate_training_session(self, user_id, session_data) -> list[NewlyUnlockedResponse]`: Orchestrates `_check_pr_badges`, `_update_volume`, and `_update_streak`. Wraps in try/except — logs errors, returns empty list on failure (never breaks the parent transaction).
    - Handle duplicate unlock attempts: catch IntegrityError from unique constraint, treat as no-op.
    - Risk: IntegrityError handling differs between SQLAlchemy async drivers. Mitigation: Use `session.begin_nested()` (savepoint) around each unlock attempt so a constraint violation doesn't roll back the outer transaction.
    - Rollback: Delete `engine.py`.
    - _Requirements: 1.1, 1.3, 3.1, 3.2_

  - [x] 4.2 Add streak tracking to `engine.py`
    - `_update_streak(self, user_id, activity_date: date) -> list[NewlyUnlockedResponse]`: Upsert `AchievementProgress` (progress_type="streak"). Read metadata_.last_active_date. If activity_date == last_active_date: no-op. If activity_date == last_active_date + 1 day: increment current_value. Else: reset current_value to 1. Update metadata_.last_active_date. Check streak thresholds and unlock.
    - Risk: Timezone handling — activity_date must be in user's timezone. Mitigation: The caller (training/nutrition service) already stores dates as calendar dates in user's timezone. Pass the session_date/entry_date directly.
    - Rollback: Revert `engine.py` to 4.1 state.
    - _Requirements: 2.1, 2.3, 2.4_

  - [x] 4.3 Add nutrition compliance checking to `engine.py`
    - `_check_nutrition_compliance(self, user_id, entry_date: date) -> list[NewlyUnlockedResponse]`: Query day's total nutrition (sum calories, protein, carbs, fat from NutritionEntry where entry_date matches). Query latest adaptive snapshot for targets. Check each macro: compliant if abs(actual - target) / target <= 0.05 (guard against target=0: treat as non-compliant). Upsert `AchievementProgress` (progress_type="nutrition_compliance"). If compliant and entry_date == last_compliant_date + 1: increment. Else if compliant: reset to 1. Else: reset to 0. Check nutrition thresholds and unlock.
    - `evaluate_nutrition_entry(self, user_id, entry_date: date) -> list[NewlyUnlockedResponse]`: Orchestrates `_update_streak` and `_check_nutrition_compliance`. Wraps in try/except.
    - Risk: Re-evaluating compliance on every nutrition entry for the same day could cause flapping. Mitigation: Always re-compute the full day's totals, not incremental. The compliance result for a day is idempotent given the same total.
    - Rollback: Revert `engine.py` to 4.2 state.
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 4.4 Write property tests for Achievement Engine
    - **Property 1: PR badge detection with metadata** — Validates: Requirements 1.1, 1.3
    - **Property 3: Streak computation and threshold unlocks** — Validates: Requirements 2.1, 2.3, 2.4
    - **Property 4: Volume calculation and threshold unlocks** — Validates: Requirements 3.1, 3.2, 3.4
    - **Property 6: Nutrition compliance check** — Validates: Requirements 4.1
    - **Property 7: Nutrition compliance streak and threshold unlocks** — Validates: Requirements 4.2, 4.3

  - [ ]* 4.5 Write unit tests for Achievement Engine edge cases
    - PR badge: exactly at threshold (60.0 kg bench), just below threshold (59.9 kg), exercise with no alias match (skipped silently), session with zero sets
    - Streak: first activity ever (streak = 1), same-day duplicate activity (no double count), gap of exactly 1 day (reset), gap of 2+ days (reset)
    - Volume: session with bodyweight exercises (weight_kg = 0, contributes 0 volume), very large session (no overflow)
    - Compliance: target is 0 for a macro (non-compliant, no division by zero), exactly at 5% boundary, all macros compliant except one (non-compliant day)
    - Duplicate unlock: calling engine twice with same qualifying session should not create duplicate UserAchievement
    - _Requirements: 1.1, 1.5, 2.1, 2.4, 3.1, 4.1_

- [x] 5. Checkpoint — Verify engine logic
  - Run full test suite: `pytest tests/test_achievement_properties.py tests/test_achievement_unit.py -v`. All property tests must pass with 100+ iterations. All unit tests must pass. Ask the user if questions arise.

- [x] 6. Implement Achievement Service and Router
  - [x] 6.1 Create `src/modules/achievements/service.py`
    - `AchievementService.__init__(self, session: AsyncSession)`
    - `get_all_achievements(self, user_id) -> list[AchievementWithStatus]`: Iterate ACHIEVEMENT_REGISTRY. For each definition, check if UserAchievement exists (unlocked). If locked, query AchievementProgress for progress fraction. Return list sorted by category then threshold.
    - `get_unlocked_achievements(self, user_id, pagination) -> PaginatedResult[UserAchievementResponse]`: Query UserAchievement where user_id matches, not deleted. Join with ACHIEVEMENT_REGISTRY for display fields. Use existing PaginatedResult pattern.
    - `get_streak(self, user_id) -> StreakResponse`: Query AchievementProgress where progress_type="streak". Return current_value and compute longest_streak from metadata_ (store longest_streak in metadata_ during streak updates in engine).
    - All queries scoped to user_id — never cross-user.
    - Risk: N+1 query in get_all_achievements (one query per definition to check unlock status). Mitigation: Batch-load all UserAchievement rows for the user in one query, then match in-memory.
    - Rollback: Delete `service.py`.
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 6.2 Create `src/modules/achievements/router.py`
    - `GET /api/v1/achievements/` — calls `get_all_achievements`, returns list of `AchievementWithStatus`
    - `GET /api/v1/achievements/unlocked` — calls `get_unlocked_achievements`, returns paginated `UserAchievementResponse`
    - `GET /api/v1/achievements/streak` — calls `get_streak`, returns `StreakResponse`
    - All endpoints require authentication (use existing `get_current_user` dependency)
    - Follow existing router patterns from `src/modules/training/router.py`
    - Risk: None significant — standard CRUD read endpoints.
    - Rollback: Delete `router.py`.
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 6.3 Write property test for user achievement isolation
    - **Property 10: User achievement isolation**
    - **Validates: Requirements 8.3**

  - [ ]* 6.4 Write unit tests for Achievement Service and Router
    - Test GET /achievements/ returns all 23 definitions with correct unlock status
    - Test GET /achievements/unlocked returns only unlocked achievements
    - Test GET /achievements/streak returns correct streak count
    - Test all endpoints return 401 without auth token
    - Test pagination on unlocked endpoint
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 7. Integrate Achievement Engine into Training and Nutrition services
  - [x] 7.1 Modify `src/modules/training/service.py` — wire achievement evaluation into `create_session`
    - After the existing `self.session.flush()` in `create_session`, instantiate `AchievementEngine(self.session)` and call `evaluate_training_session(user_id, data)`.
    - Add `newly_unlocked` field to `TrainingSessionResponse` schema (list[NewlyUnlockedResponse], default empty).
    - Pass newly_unlocked results into `TrainingSessionResponse.from_orm_model()`.
    - Wrap achievement call in try/except — if it fails, log error and return response with empty newly_unlocked. Training session creation must never fail due to achievements.
    - Risk: Adding latency to the critical training POST path. Mitigation: Engine queries are against indexed columns with small result sets. Monitor p99 latency post-launch.
    - Rollback: Revert `service.py` and `schemas.py` changes in training module.
    - _Requirements: 1.1, 2.1, 3.1, 7.1_

  - [x] 7.2 Modify `src/modules/nutrition/service.py` — wire achievement evaluation into `create_entry`
    - After the existing `self.session.flush()` in `create_entry`, instantiate `AchievementEngine(self.session)` and call `evaluate_nutrition_entry(user_id, data.entry_date)`.
    - Return newly_unlocked in the nutrition entry response. Add `newly_unlocked` field to the response or return it as a separate field in the API response body.
    - Wrap in try/except — same pattern as training.
    - Risk: Nutrition compliance check queries adaptive snapshots — if that table is empty, compliance check should gracefully skip. Mitigation: Already handled in engine (4.3).
    - Rollback: Revert `service.py` changes in nutrition module.
    - _Requirements: 2.1, 4.1, 4.2, 7.1_

  - [x] 7.3 Register achievements router in `src/main.py`
    - Add `from src.modules.achievements.router import router as achievements_router` and `app.include_router(achievements_router, prefix="/api/v1/achievements", tags=["achievements"])`
    - Risk: Router prefix collision. Mitigation: No existing router uses `/achievements`.
    - Rollback: Remove the two lines from `main.py`.
    - _Requirements: 8.1_

  - [ ]* 7.4 Write property test for newly unlocked in API response
    - **Property 9: API response includes newly unlocked achievements**
    - **Validates: Requirements 7.1**

  - [ ]* 7.5 Write property test for achievement permanence after soft-delete
    - **Property 5: Achievement permanence after soft-delete**
    - **Validates: Requirements 1.4, 3.3**

  - [ ]* 7.6 Write integration tests for training + achievement flow
    - Create a training session with bench press at 60 kg → verify PR badge unlocked in response
    - Create a training session with unknown exercise → verify no crash, empty newly_unlocked
    - Create two sessions on consecutive days → verify streak increments
    - Soft-delete a session that triggered a volume milestone → verify milestone still unlocked
    - _Requirements: 1.1, 1.4, 2.1, 3.3, 7.1_

  - [ ]* 7.7 Write integration tests for nutrition + achievement flow
    - Create nutrition entries hitting all macro targets within 5% → verify compliance day counted
    - Create entries for 7 consecutive compliant days → verify nutrition_7 badge unlocked
    - Create a non-compliant day mid-streak → verify counter resets
    - _Requirements: 4.1, 4.2, 4.3, 7.1_

- [x] 8. Checkpoint — Verify full backend
  - Run complete backend test suite: `pytest tests/ -v -k achievement`. All property tests (100+ iterations), unit tests, and integration tests must pass. Manually test endpoints via `/api/v1/docs`. Ask the user if questions arise.

- [x] 9. Implement frontend achievement components
  - [x] 9.1 Create `app/components/achievements/AchievementCard.tsx`
    - Individual achievement tile: icon (full color if unlocked, grayed if locked), title, unlock date or progress bar
    - Props: `definition`, `unlocked`, `unlockedAt`, `progress` (0-1 fraction), `onPress`
    - Use existing `Card` component as base, `ProgressRing` for circular progress on locked achievements
    - Accessible: proper `accessibilityLabel`, `accessibilityRole="button"`
    - Risk: None — isolated presentational component.
    - Rollback: Delete file.
    - _Requirements: 5.2, 5.3_

  - [x] 9.2 Create `app/components/achievements/AchievementGrid.tsx`
    - Fetches `GET /achievements/` on mount, shows loading skeleton during fetch
    - Groups achievements by category, renders section headers + grid of AchievementCard
    - Uses `FlatList` with `numColumns={3}` for grid layout
    - Props: none (self-contained, fetches own data)
    - Risk: Large number of achievements (23) may cause layout issues on small screens. Mitigation: Use responsive column count based on screen width.
    - Rollback: Delete file.
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 9.3 Create `app/components/achievements/CelebrationModal.tsx`
    - Full-screen modal with achievement icon, title, description, congratulatory message
    - Props: `achievements: NewlyUnlocked[]`, `visible: boolean`, `onDismiss: () => void`
    - If multiple achievements, show first one with "Next" button; on last one show "Done"
    - Uses `ModalContainer` component as base
    - Animated entrance (scale + fade) using `react-native-reanimated`
    - Risk: Modal conflicts with other modals (AddTrainingModal, etc.). Mitigation: Queue celebration modal to show after other modals close — use a store flag.
    - Rollback: Delete file.
    - _Requirements: 7.2, 7.3, 7.4_

  - [x] 9.4 Create `app/components/achievements/ShareableCard.tsx`
    - Styled view containing achievement icon, title, description, unlock date, app branding
    - Uses `react-native-view-shot` to capture the view as an image
    - `onShare` prop triggers capture + native share sheet via `react-native-share` or `expo-sharing`
    - Risk: `react-native-view-shot` may not work on web. Mitigation: Conditionally disable share button on web platform.
    - Rollback: Delete file.
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 9.5 Write property test for achievement grouping logic
    - **Property 8: Achievement grouping by category**
    - Create a `groupAchievementsByCategory` utility function in `app/utils/achievementLogic.ts` and test it with fast-check
    - **Validates: Requirements 5.1**

- [x] 10. Integrate frontend components into existing screens
  - [x] 10.1 Add AchievementGrid to ProfileScreen
    - Import `AchievementGrid` in `app/screens/profile/ProfileScreen.tsx`
    - Add as a new `Animated.View` section between Features and Subscription sections
    - Add `SectionHeader title="Achievements"` above the grid
    - Add staggered entrance animation following existing pattern
    - Risk: ProfileScreen already has many sections — adding more may slow initial render. Mitigation: AchievementGrid fetches lazily and shows skeleton.
    - Rollback: Remove the import and JSX block from ProfileScreen.
    - _Requirements: 5.1, 5.4_

  - [x] 10.2 Add CelebrationModal to DashboardScreen
    - Add achievement state to Zustand store: `pendingCelebrations: NewlyUnlocked[]`, `setPendingCelebrations`, `clearCelebrations`
    - In DashboardScreen, after `loadDashboardData` processes training/nutrition responses, check for `newly_unlocked` in responses and set `pendingCelebrations`
    - Render `CelebrationModal` at bottom of DashboardScreen JSX, controlled by store state
    - Risk: Celebration modal may fire during pull-to-refresh, which feels jarring. Mitigation: Only trigger celebrations from explicit user actions (log food, log training), not from background refreshes.
    - Rollback: Revert DashboardScreen changes, remove store additions.
    - _Requirements: 7.2, 7.3, 7.4_

  - [x] 10.3 Enhance StreakIndicator on Dashboard with achievement API data
    - Modify `DashboardScreen` to fetch `GET /achievements/streak` and pass `current_streak` to the existing `StreakIndicator` component
    - If the streak API fails, fall back to the existing client-side `calculateStreak` logic
    - Risk: Extra API call on dashboard load. Mitigation: Fire in parallel with existing `Promise.allSettled` batch.
    - Rollback: Revert DashboardScreen fetch changes.
    - _Requirements: 2.5, 2.6_

  - [ ]* 10.4 Write frontend unit tests
    - Test AchievementGrid renders correct number of cards
    - Test AchievementCard shows progress bar when locked, date when unlocked
    - Test CelebrationModal cycles through multiple achievements sequentially
    - Test ShareableCard contains required fields (icon, title, description, date, branding)
    - Test groupAchievementsByCategory utility
    - _Requirements: 5.1, 5.2, 5.3, 7.2, 7.4, 6.1_

- [x] 11. Final checkpoint — Full system verification
  - Run all backend tests: `pytest tests/ -v -k achievement`
  - Run all frontend tests: relevant test files in `app/__tests__/`
  - Verify all 11 correctness properties pass
  - Manually test: create training session triggering PR badge → celebration modal appears → achievement shows on profile → share card generates
  - Manually test: log 2 consecutive days → streak shows on dashboard
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints gate forward progress — do not proceed past a checkpoint with failing tests
- Property tests validate universal correctness properties (100+ iterations each)
- Unit tests validate specific examples and edge cases
- The achievement engine is wrapped in try/except at every integration point — it can never break training or nutrition flows
- Rollback for any step: revert the files listed in that step. The achievement router is registered last, so partial work is inert.
