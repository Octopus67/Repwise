# Comprehensive Test Plan — Regression Prevention

**Generated:** 2026-03-17  
**Purpose:** Prevent regressions for 130 bugs fixed today  
**Total Tests:** 85 (30 critical, 25 high, 20 medium, 10 low)

---

## Test Organization

### Backend Tests (45 tests)
- `tests/test_auth_security.py` — Security fixes (15 tests)
- `tests/test_rate_limiting.py` — Rate limiting (10 tests)
- `tests/test_training_prs.py` — PR detection (8 tests)
- `tests/test_nutrition_tracking.py` — Food frequency (5 tests)
- `tests/test_meal_plans.py` — Meal plan variety (4 tests)
- `tests/test_export.py` — Export fixes (3 tests)

### Frontend Tests (40 tests)
- `app/__tests__/auth/` — Auth flows (12 tests)
- `app/__tests__/training/` — Active workout (10 tests)
- `app/__tests__/nutrition/` — Nutrition logging (8 tests)
- `app/__tests__/dashboard/` — Dashboard (5 tests)
- `app/__tests__/components/` — Component fixes (5 tests)

---

## Phase 1: Security Tests (15 tests, CRITICAL)

### 1.1 Timing Oracle Tests (3 tests)

**Test:** `test_login_timing_oracle_mitigated`
- Measure response time for user-not-found (20 samples)
- Measure response time for wrong-password (20 samples)
- Assert median difference < 50ms
- **Prevents:** User enumeration via timing side-channel

**Test:** `test_forgot_password_timing_normalized`
- Same pattern for forgot-password endpoint
- **Prevents:** Email enumeration via timing

**Test:** `test_reset_password_timing_normalized`
- Same pattern for reset-password endpoint
- **Prevents:** Email enumeration via timing

### 1.2 OAuth Security Tests (4 tests)

**Test:** `test_apple_oauth_nonce_verification_success`
- Generate nonce, hash with SHA256
- Create mock Apple JWT with hashed nonce claim
- Send raw nonce to backend
- Assert 200 response

**Test:** `test_apple_oauth_nonce_verification_failure`
- Send mismatched nonce
- Assert 401 response

**Test:** `test_apple_oauth_nonce_optional_backward_compat`
- Send Apple OAuth without nonce field
- Assert still works (backward compatibility)

**Test:** `test_oauth_conflict_doesnt_leak_provider`
- Register with email via password
- Try OAuth with same email
- Assert error message doesn't mention "another provider"

### 1.3 SQL Injection Tests (2 tests)

**Test:** `test_pr_detector_exercise_name_injection`
- Create exercise with name containing quotes: `Bench "Press`
- Log workout
- Assert no SQL error, PRs detected correctly

**Test:** `test_pr_detector_exercise_name_regex_chars`
- Exercise name with regex chars: `Squat (.*)`
- Assert no query errors

### 1.4 Soft Delete Tests (3 tests)

**Test:** `test_shared_workout_respects_soft_delete`
- Share workout, verify accessible
- Soft-delete workout
- Assert share link returns 404

**Test:** `test_prs_from_deleted_sessions_filtered`
- Create session with PR
- Soft-delete session
- Assert PR doesn't appear in /personal-records

**Test:** `test_track_share_checks_soft_delete`
- Soft-delete a session
- Try to create ShareEvent for it
- Assert 404 (ownership check fails)

### 1.5 Password Validation Tests (3 tests)

**Test:** `test_password_validation_frontend_backend_aligned`
- Frontend: Test 'alllowercase' → isValid=false
- Backend: POST with 'alllowercase' → 422
- Both reject for same reason

**Test:** `test_password_requires_uppercase_lowercase_digit`
- Test all combinations missing one requirement
- Assert all rejected

**Test:** `test_password_max_length_128`
- Test 128-char password → accepted
- Test 129-char password → rejected

---

## Phase 2: Data Integrity Tests (18 tests, HIGH)

### 2.1 Food Frequency Tracking (5 tests)

**Test:** `test_food_item_id_included_in_post`
- Mock AddNutritionModal submit
- Assert payload includes food_item_id when selectedFood exists

**Test:** `test_frequency_increments_on_log`
- Log food 3 times
- Assert UserFoodFrequency.log_count == 3

**Test:** `test_frequency_affects_search_ranking`
- Log food A 10 times, food B 1 time
- Search for both
- Assert food A ranks higher

**Test:** `test_frequency_tracking_without_food_item_id`
- Log entry with food_name but no food_item_id
- Assert no frequency record created (graceful)

**Test:** `test_frequency_last_logged_at_updates`
- Log food, check timestamp
- Wait 1 second, log again
- Assert last_logged_at updated

### 2.2 PR Detection Tests (8 tests)

**Test:** `test_pr_detection_first_time_exercise`
- User's first Bench Press ever
- Assert PR detected with previous_weight_kg=None

**Test:** `test_pr_detection_first_time_rep_count`
- User has done Squat at 5 reps before
- First time at 8 reps
- Assert PR detected

**Test:** `test_pr_detection_not_triggered_for_lower_weight`
- Historical best: 100kg × 5
- New set: 95kg × 5
- Assert no PR

**Test:** `test_pr_detection_on_session_update`
- Edit session to increase weight
- Assert new PR detected and returned in response

**Test:** `test_pr_detection_excludes_warm_up_sets`
- Log workout with warm-up sets at high weight
- Assert warm-ups don't trigger PRs

**Test:** `test_prs_from_deleted_sessions_not_in_history`
- Create session with PR, soft-delete
- GET /personal-records
- Assert deleted session's PR not in list

**Test:** `test_pr_detector_handles_duplicate_exercise_names`
- Workout with 2× Bench Press
- Assert PRs detected for both instances

**Test:** `test_pr_celebration_shows_on_frontend`
- Mock workout save with PRs in response
- Assert PRCelebration modal opens

### 2.3 Duplicate Data Tests (3 tests)

**Test:** `test_duplicate_exercise_notes_preserved`
- Workout with 2× Squat, each with different notes
- Assert both notes in metadata

**Test:** `test_duplicate_meal_favorites_prevented`
- Add favorite twice
- Assert only one record created

**Test:** `test_copy_entries_idempotency`
- Copy meals from date A to B
- Copy again
- Assert entries not duplicated

### 2.4 Meal Plan Tests (2 tests)

**Test:** `test_meal_plan_day_variety`
- Generate 5-day plan
- Assert day 0 ≠ day 1 ≠ day 2

**Test:** `test_meal_plan_intra_day_variety`
- Generate 1-day plan with 4 slots
- Assert breakfast ≠ lunch ≠ dinner ≠ snack

---

## Phase 3: Rate Limiting Tests (10 tests, HIGH)

### 3.1 DB-Backed Rate Limiting (4 tests)

**Test:** `test_db_rate_limiter_check_without_record`
- Call check_db_rate_limit 4 times
- Assert no RateLimitEntry rows created (check doesn't record)

**Test:** `test_db_rate_limiter_record_on_failure`
- Login with wrong password
- Assert RateLimitEntry created

**Test:** `test_db_rate_limiter_reset_on_success`
- Make 4 failed attempts, then succeed
- Assert RateLimitEntry rows deleted

**Test:** `test_registration_db_rate_limiting`
- Register 5 times from same IP
- 6th attempt should be 429

### 3.2 IP-Based Rate Limiting (3 tests)

**Test:** `test_login_ip_rate_limiting`
- Try 20 different emails from same IP
- 21st should be 429

**Test:** `test_ip_rate_limit_independent_of_email`
- Hit email rate limit (5 attempts)
- Try different email from same IP
- Should still work (separate counters)

**Test:** `test_ip_extraction_from_xff`
- Mock X-Forwarded-For header
- Assert correct IP extracted

### 3.3 Account Lockout Tests (3 tests)

**Test:** `test_account_lockout_after_3_violations`
- Trigger rate limit 3 times in 24h
- Assert 24h lockout

**Test:** `test_lockout_cleared_after_24h`
- Trigger lockout
- Fast-forward time 25 hours
- Assert can login again

**Test:** `test_lockout_violations_expire`
- Trigger 2 violations
- Wait 25 hours
- Trigger 1 more
- Assert no lockout (old violations expired)

---

## Phase 4: UI/UX Tests (15 tests, MEDIUM)

### 4.1 Swipe Gesture Tests (3 tests)

**Test:** `test_set_swipe_delete_threshold`
- Swipe -79px → should snap back
- Swipe -81px → should delete

**Test:** `test_set_swipe_doesnt_conflict_with_scroll`
- Vertical scroll gesture
- Assert set not deleted

**Test:** `test_set_swipe_last_set_guard`
- Exercise with 1 set
- Swipe to delete
- Assert set remains (can't delete last)

### 4.2 Validation Tests (5 tests)

**Test:** `test_weight_zero_rejected`
- Try completing set with weight=0
- Assert validation error

**Test:** `test_weight_max_9999`
- Enter weight=10000
- Assert rejected

**Test:** `test_rpe_rir_sync`
- Set RPE=8
- Assert RIR auto-updates to 2

**Test:** `test_barcode_multiplier_max_99`
- Enter multiplier=100
- Assert rejected

**Test:** `test_recipe_servings_max_99`
- Enter servings=100
- Assert rejected

### 4.3 Loading State Tests (3 tests)

**Test:** `test_workout_init_shows_loading`
- Mount ActiveWorkoutScreen with mode='template'
- Assert ActivityIndicator visible during fetch

**Test:** `test_analytics_retry_shows_loading`
- Load analytics, fail, retry
- Assert loading skeleton shows on retry

**Test:** `test_pr_history_load_more_shows_loading`
- Tap "Load More"
- Assert loading indicator on button

### 4.4 Error Feedback Tests (4 tests)

**Test:** `test_template_not_found_shows_alert`
- Start workout with invalid templateId
- Assert alert shown

**Test:** `test_edit_session_404_shows_alert`
- Edit mode with deleted sessionId
- Assert alert shown

**Test:** `test_copy_last_no_sessions_shows_alert`
- Copy-last with no history
- Assert alert shown

**Test:** `test_analytics_errors_logged`
- Mock API failure
- Assert console.warn called

---

## Phase 5: Performance Tests (12 tests, MEDIUM)

### 5.1 API Call Count Tests (4 tests)

**Test:** `test_dashboard_api_call_count`
- Mount dashboard
- Count API calls
- Assert ≤ 10 (was 19)

**Test:** `test_dashboard_parallel_execution`
- Mock slow API responses
- Measure total load time
- Assert < 2s (not 5s+)

**Test:** `test_shopping_list_batch_query`
- Generate plan with 20 items
- Count DB queries
- Assert ≤ 5 (not 20+)

**Test:** `test_session_detail_exercise_images_batch`
- View session with 10 exercises
- Assert 1 API call for images (not 10)

### 5.2 Memoization Tests (4 tests)

**Test:** `test_meal_slot_group_sort_memoized`
- Render MealSlotGroup
- Re-render with same props
- Assert sort function called once

**Test:** `test_today_workout_card_memo_works`
- Render with sessions
- Re-render with same sessions
- Assert component didn't re-render

**Test:** `test_feature_flag_cache_dedup`
- Mount 3 components using same flag
- Assert 1 API call (not 3)

**Test:** `test_feature_flag_cache_ttl`
- Fetch flag
- Wait 6 minutes
- Fetch again
- Assert 2 API calls (cache expired)

### 5.3 StyleSheet Tests (4 tests)

**Test:** `test_today_workout_card_uses_styles_variable`
- Check component doesn't call getStyles()
- Uses pre-computed styles

**Test:** `test_recovery_checkin_no_getstyles_in_stepper`
- Stepper receives styles as props
- Doesn't call getThemeColors()

**Test:** `test_learn_screen_article_card_memoized_styles`
- AnimatedArticleCard doesn't recreate StyleSheet

**Test:** `test_weekly_checkin_card_uses_styles`
- Component uses pre-computed styles

---

## Phase 6: Edge Case Tests (15 tests, LOW-MEDIUM)

### 6.1 Onboarding Tests (4 tests)

**Test:** `test_onboarding_hydration_gate`
- Check _hydrated flag before rendering
- Show loading until hydrated

**Test:** `test_onboarding_sex_null_handling`
- sex=null doesn't crash BMR calculation

**Test:** `test_lifestyle_step_validation_gate`
- exerciseSessionsPerWeek > 0 but no types
- Next button disabled

**Test:** `test_goal_step_validation_gate`
- Target weight contradicts goal
- Next button disabled

### 6.2 Crash Recovery Tests (3 tests)

**Test:** `test_workout_crash_recovery_preserves_state`
- Start workout, add exercises
- Kill app, restart
- Assert workout restored

**Test:** `test_crash_recovery_duration_accurate`
- Start workout, crash for 1 hour, resume
- Assert duration doesn't include crash time

**Test:** `test_finish_workout_resets_state`
- Finish workout
- Crash before discard
- Resume
- Assert no stale workout

### 6.3 Bounds Checking Tests (4 tests)

**Test:** `test_reorder_exercises_bounds`
- Try reordering with fromIndex=-1
- Assert no crash, no change

**Test:** `test_reorder_exercises_out_of_range`
- Try toIndex=999
- Assert no crash

**Test:** `test_custom_exercise_min_length`
- Try adding 1-char exercise name
- Assert rejected

**Test:** `test_barcode_user_id_scoping`
- User A scans barcode
- User B searches
- Assert User B doesn't see User A's scan

### 6.4 Date Handling Tests (4 tests)

**Test:** `test_analytics_date_calc_handles_dst`
- Set date to DST boundary
- Calculate 90 days back
- Assert correct date (not off by 1)

**Test:** `test_measurement_date_validation`
- Enter invalid date '2024-13-45'
- Assert rejected

**Test:** `test_recovery_checkin_uses_selected_date`
- Navigate to past date
- Submit checkin
- Assert uses selectedDate not today

**Test:** `test_onboarding_birth_year_validation`
- Enter birthYear=1800
- Assert rejected (< 1900)

---

## Phase 7: Component Tests (10 tests, LOW)

### 7.1 Gesture Tests (3 tests)

**Test:** `test_set_swipe_delete_animation`
- Swipe set left
- Assert translateX animates to -300
- Assert onRemoveSet called

**Test:** `test_set_swipe_snap_back`
- Swipe -50px (below threshold)
- Assert snaps back to 0

**Test:** `test_exercise_picker_sheet_custom_item`
- Search for non-existent exercise
- Assert "+ Add" row appears

### 7.2 Modal Tests (3 tests)

**Test:** `test_add_bodyweight_modal_unsaved_guard`
- Enter weight, tap close
- Assert confirmation dialog

**Test:** `test_recovery_checkin_modal_container`
- Verify uses ModalContainer
- Has swipe-to-dismiss

**Test:** `test_quick_add_modal_renders`
- Open QuickAddModal
- Assert renders without crash

### 7.3 State Tests (4 tests)

**Test:** `test_learn_screen_favorites_functional_update`
- Toggle favorite
- API fails
- Assert correct revert (not stale)

**Test:** `test_onboarding_slice_hydrated_flag`
- Store initializes
- Assert _hydrated=false
- After loadState
- Assert _hydrated=true

**Test:** `test_meal_slot_group_smart_expand`
- Empty slot → collapsed
- Slot with entries → expanded

**Test:** `test_today_workout_card_memo_callbacks`
- Parent re-renders with new onPress
- Assert TodayWorkoutCard re-renders

---

## Phase 8: Integration Tests (10 tests, MEDIUM)

### 8.1 End-to-End Flows (5 tests)

**Test:** `test_full_auth_flow`
- Register → verify email → login → logout

**Test:** `test_full_workout_flow`
- Start → add exercise → log sets → swipe delete set → finish → save

**Test:** `test_full_nutrition_flow`
- Search food → select → adjust serving → save → verify frequency

**Test:** `test_full_meal_plan_flow`
- Generate → save → shopping list → verify variety

**Test:** `test_full_export_flow`
- Request export → poll → download → verify no 404

### 8.2 Cross-Module Tests (5 tests)

**Test:** `test_pr_triggers_achievement`
- Log workout with PR
- Assert achievement evaluated

**Test:** `test_nutrition_entry_triggers_achievement`
- Log food
- Assert nutrition achievement checked

**Test:** `test_workout_updates_challenge_progress`
- Active challenge
- Log workout
- Assert progress incremented

**Test:** `test_dashboard_refresh_updates_all_widgets`
- Pull to refresh
- Assert all data sources reload

**Test:** `test_rate_limit_shows_retry_after`
- Hit rate limit
- Assert Retry-After header present
- Frontend shows countdown

---

## Phase 9: Regression Tests (15 tests, CRITICAL)

### 9.1 Previously Fixed Bugs (10 tests)

**Test:** `test_register_enumeration_prevention`
- Register with existing email
- Assert generic message (no "already exists")

**Test:** `test_email_normalization_case_insensitive`
- Register User@Example.com
- Login user@example.com
- Assert works

**Test:** `test_otp_invalidation_before_new`
- Request reset code
- Request again
- Assert old code marked used=True

**Test:** `test_token_refresh_rotation`
- Refresh token
- Old refresh token blacklisted
- Can't reuse old token

**Test:** `test_logout_clears_tokens`
- Logout
- Assert tokens deleted from SecureStore
- Assert tokens blacklisted

**Test:** `test_idor_coaching_ownership`
- User A creates coaching request
- User B tries to cancel it
- Assert 404

**Test:** `test_idor_food_database_recipes`
- User A creates recipe
- User B tries to view
- Assert 404

**Test:** `test_input_validation_query_params`
- Send 201-char search query
- Assert 422 (max_length=200)

**Test:** `test_input_validation_jsonb_size`
- Send 11KB metadata
- Assert 422 (max 10KB)

**Test:** `test_filename_sanitization`
- Upload with filename '../../../etc/passwd'
- Assert sanitized to 'etc_passwd'

### 9.2 Security Hardening Tests (5 tests)

**Test:** `test_security_headers_present`
- Make any API request
- Assert HSTS, X-Frame-Options, etc. in response

**Test:** `test_body_size_limit_enforced`
- POST with 2MB body
- Assert 413

**Test:** `test_global_rate_limiter_100_rpm`
- Make 101 requests in 60s
- 101st should be 429

**Test:** `test_trusted_host_validation`
- Request with invalid Host header
- Assert rejected (in prod mode)

**Test:** `test_https_redirect_in_production`
- HTTP request in prod mode
- Assert 307 redirect to HTTPS

---

## Test Implementation Priority

### Must Have (30 tests) — Before Deploy
1. All Phase 1 (Security) — 15 tests
2. Phase 2.1-2.2 (Data Integrity) — 13 tests
3. Phase 9.1 (Regression) — 10 tests (subset)

### Should Have (25 tests) — Before Beta
4. Phase 3 (Rate Limiting) — 10 tests
5. Phase 4 (UI/UX) — 15 tests

### Nice to Have (30 tests) — Ongoing
6. Phase 5 (Performance) — 12 tests
7. Phase 6 (Edge Cases) — 15 tests
8. Phase 8 (Integration) — 10 tests (subset)

---

## Test Infrastructure Needs

### Backend
- `pytest-asyncio` for async tests ✅ (already installed)
- `pytest-mock` for mocking ✅
- `freezegun` for time manipulation (NEW)
- Test fixtures for users, sessions, foods

### Frontend
- `@testing-library/react-native` ✅
- `react-native-gesture-handler/jest-utils` for gesture tests (NEW)
- `jest-expo` ✅
- Mock for `expo-secure-store`, `expo-file-system`

---

## Estimated Effort

| Phase | Tests | Hours |
|-------|-------|-------|
| Phase 1: Security | 15 | 6-8 |
| Phase 2: Data | 18 | 6-8 |
| Phase 3: Rate Limiting | 10 | 4-5 |
| Phase 4: UI/UX | 15 | 5-6 |
| Phase 5: Performance | 12 | 4-5 |
| Phase 6: Edge Cases | 15 | 5-6 |
| Phase 7: Components | 10 | 3-4 |
| Phase 8: Integration | 10 | 4-5 |
| Phase 9: Regression | 15 | 5-6 |
| **TOTAL** | **120** | **42-53 hours** |

---

**Test plan complete. Ready to implement all 120 tests across 9 phases.**

Proceeding with implementation now.
