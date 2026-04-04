# Lessons Learned

**Purpose:** Track patterns from mistakes to prevent repeating them

## Template
```markdown
## [Date] - [Issue]
**What went wrong:** [Description]
**Root cause:** [Why it happened]
**Fix:** [What was done]
**Lesson:** [Rule to prevent future occurrences]
```

## Lessons

### 2026-03-10 - Infinite Loop on Dashboard
**What went wrong:** 37,000+ API requests, app froze
**Root cause:** loadDashboardData in useEffect deps, recreated every render
**Fix:** Removed from dependency array
**Lesson:** Don't include recreated callbacks in useEffect deps - causes infinite loops

### 2026-03-10 - VolumePills Crash
**What went wrong:** "Rendered more hooks than previous render"
**Root cause:** getPillColor helper called useThemeColors() inside .map()
**Fix:** Pass ThemeColors as parameter instead
**Lesson:** Never call hooks inside loops, conditions, or helper functions

### 2026-03-15 - Massive Feature + Bug Fix Session

**Scope:** 73 files changed, 1556 insertions, 934 deletions across features, conversion, retention, and bug fixes.

**Key Lessons Learned:**

#### SQLite Compatibility (3 separate crashes)
**What went wrong:** `server_default=text("now()")` crashed on SQLite in StreakFreeze, PersonalRecord, and Subscription models. Also `create_all()` didn't add new columns to existing tables.
**Root cause:** PostgreSQL-only `now()` function. SQLite uses `CURRENT_TIMESTAMP`.
**Fix:** Changed all `now()` to `CURRENT_TIMESTAMP`. Added ALTER TABLE statements in main.py lifespan. Set datetime fields explicitly in Python code.
**Lesson:** Always use `CURRENT_TIMESTAMP` for server_defaults. After adding model columns, add ALTER TABLE in lifespan.

#### Reanimated Web Crashes (Analytics page broken)
**What went wrong:** `useAnimatedProps` on SVG elements crashed the entire Analytics page on Expo Web.
**Root cause:** `UpdatePropsManager` is native-only in Reanimated.
**Fix:** Added `Platform.OS === 'web'` guards in BodySilhouette, ProgressRing, RestTimerRing.
**Lesson:** Always check Reanimated API web compatibility. `useAnimatedProps` and `createAnimatedComponent(SVG)` need platform guards.

#### TouchableOpacity on Web (X button not working)
**What went wrong:** Close buttons in modals didn't fire on Expo Web.
**Root cause:** `TouchableOpacity` inside gesture handlers or nested pressable contexts is unreliable on web.
**Fix:** Changed to `Pressable` in ModalContainer, RecipeBuilderScreen, AddNutritionModal.
**Lesson:** Use `Pressable` for all interactive elements inside modals on web.

#### MealBuilder Add Item Broken (Critical product bug)
**What went wrong:** "Add Item" in MealBuilder opened AddNutritionModal which logged food directly to API instead of adding to the builder's item list.
**Root cause:** No callback mechanism to return food data to parent. `handleAddItem` existed but was never called.
**Fix:** Added `onAddItem?` callback prop to AddNutritionModal. In select mode: returns data to parent, skips API POST.
**Lesson:** When reusing a component in a different context, add a mode/callback prop rather than duplicating the component.

#### AchievementDetailSheet Hook Crash
**What went wrong:** "Rendered more hooks than previous render" when tapping achievements.
**Root cause:** `getAchievementColor()` called `useThemeColors()` inside a regular function, after an early return.
**Fix:** Pass theme colors as parameter instead of calling hook inside helper.
**Lesson:** Same as 2026-03-10 VolumePills lesson — hooks ONLY at component top level. This pattern keeps recurring.

#### Activity Level Mapping Error (Silent data corruption)
**What went wrong:** `highly_active` mapped to `very_active` instead of `active`, overestimating TDEE by 200-400 kcal/day.
**Root cause:** Copy-paste error in onboardingPayloadBuilder.ts mapping object.
**Fix:** Changed `'highly_active': 'very_active'` to `'highly_active': 'active'`.
**Lesson:** When mapping enums between frontend and backend, verify each value maps to a UNIQUE backend value.

#### Timezone-Naive Datetime Comparison (trial_service crash)
**What went wrong:** `now < ends_at` crashed with `TypeError: can't compare offset-naive and offset-aware datetimes`.
**Root cause:** `datetime.utcnow()` returns naive datetime, but DB column stores aware datetime.
**Fix:** Added `if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)` guard.
**Lesson:** Always use `datetime.now(timezone.utc)` and guard DB values before comparison.

#### Challenge Progress Never Updated (Feature completely non-functional)
**What went wrong:** Weekly challenges always showed 0/target progress.
**Root cause:** No hook between workout completion and challenge progress update. The `update_challenge_progress_from_session` function didn't exist.
**Fix:** Created the function and wired it into `TrainingService.create_session()`.
**Lesson:** When building a feature that depends on events from another module, wire the integration immediately — don't leave it as a TODO.

#### Recipe Save 500 Error (JSONB non-numeric values)
**What went wrong:** `value * scale` crashed when micro_nutrients contained lists or strings.
**Root cause:** JSONB micro_nutrients field can contain any JSON type, not just numbers.
**Fix:** Added `if isinstance(value, (int, float)):` guard before arithmetic.
**Lesson:** Never assume JSONB values are numeric. Always type-check before arithmetic operations.

### 2026-03-20 - Overhaul Lessons (TanStack Query, Payments, Async Safety)

#### RevenueCat Webhook Subscription Creation
**What went wrong:** Webhook failed to create subscriptions for direct purchases.
**Root cause:** _get_or_create_subscription_from_webhook() state machine didn't allow FREE→ACTIVE.
**Fix:** Allow FREE→ACTIVE transition for direct purchases.
**Lesson:** RevenueCat webhook creates subscription via _get_or_create_subscription_from_webhook(). State machine must allow FREE→ACTIVE for direct purchases.

#### RevenueCat provider_subscription_id Confusion
**What went wrong:** provider_subscription_id was set to app_user_id instead of original_transaction_id.
**Root cause:** These are different identifiers; wrong field was used.
**Fix:** Use original_transaction_id for provider_subscription_id.
**Lesson:** provider_subscription_id should be original_transaction_id, NOT app_user_id. These are different identifiers.

#### RevenueCat Renewal Expiration Not Updated
**What went wrong:** Renewals didn't extend access — current_period_end never updated.
**Root cause:** expiration_at_ms not extracted from webhook payload.
**Fix:** Extract expiration_at_ms from RevenueCat webhooks and update current_period_end.
**Lesson:** Always extract expiration_at_ms from RevenueCat webhooks and update current_period_end. Without this, renewals don't extend access.

#### asyncio.gather with Shared AsyncSession
**What went wrong:** Coaching service had intermittent failures under load.
**Root cause:** asyncio.gather with shared SQLAlchemy AsyncSession is unsafe (concurrent operations on same session).
**Fix:** Changed to sequential awaits.
**Lesson:** asyncio.gather with shared AsyncSession is unsafe in SQLAlchemy async. Use sequential awaits.

#### In-Memory Rate Limiting Useless with Gunicorn
**What went wrong:** Rate limits weren't enforced — each worker had its own counter.
**Root cause:** In-memory dicts don't share state across Gunicorn workers.
**Fix:** Migrated all 10 rate limiters to Redis sorted sets.
**Lesson:** In-memory rate limiting is useless with multiple Gunicorn workers. Must use Redis.

#### Hardcoded Provider Names in Tests
**What went wrong:** Tests broke after simplifying payment providers.
**Root cause:** Fixtures had hardcoded provider_name='stripe' that no longer existed.
**Fix:** Updated test fixtures to use correct provider names.
**Lesson:** When simplifying payment providers, check tests for hardcoded provider names (e.g., provider_name='stripe' in fixtures).

### 2026-03-27 - User's Preferred Prompt Structure for Implementation Tasks

**Pattern:** User wants ALL implementation tasks structured as phased execution with interleaved audits.

**The Template:**

1. **Break the plan into phases** — each phase is a logical chunk of work
2. **TODO list alternates implement/audit** — never group all implementations together:
   ```
   [ ] Phase 1: Implement — [description]
   [ ] Phase 1: Audit & Fix — review, fix, re-audit until zero findings
   [ ] Phase 2: Implement — [description]
   [ ] Phase 2: Audit & Fix — review, fix, re-audit until zero findings
   ...
   [ ] Final: Regression check + summary
   ```
3. **Phase execution loop** (every phase, no exceptions):
   - Read the plan section, list files to create/modify
   - Implement (max 200 lines/file, type hints, docstrings, error handling, tests alongside code)
   - Verify (imports resolve, tests pass, app doesn't crash)
   - Audit as if someone else wrote it (logic errors, edge cases, type mismatches, race conditions, security, perf, cross-phase compatibility)
   - Fix all findings in one batch, re-run tests
   - Re-audit until ZERO issues
   - Regression check all previous phases' tests
   - Checkpoint log: files changed, tests added, findings found/fixed, audit passes count
4. **No human interaction mid-execution** — complete ALL phases, then present final summary
5. **Final regression check** across all phases before declaring done

**Rules:**
- Phase not complete until audit returns zero findings
- Don't start Phase N+1 until Phase N audit is clean
- Don't commit/push until told to
- Don't delete existing tests unless explicitly asked
- If stuck after 2 attempts, log it and move on — flag in checkpoint
- Audit must be independent — review as if someone else wrote it

**Lesson:** When generating prompts for the user, ALWAYS structure them with this phased implement→audit pattern. The user will paste these prompts into another agent session. Include the full execution framework (the critical box, TODO structure, phase loop, and rules) in every prompt.