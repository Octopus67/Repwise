# Requirements Document — Profile Redesign

## 1. User Problem

> "I opened my profile to update my weight after a cut, and I couldn't find where to do it. Instead I see rest timer settings I never use here, a bunch of 'Not set' fields, and a giant red Delete Account button staring at me. This page doesn't help me do anything useful."

The Profile screen is the only place users can manage the data that drives the entire adaptive engine (body stats, goals), yet it buries that data or omits it entirely. Instead it surfaces training-specific settings (rest timers) that belong in the training modal, shows empty locale fields with no smart defaults, and gives destructive actions (Delete Account) equal visual weight to everyday actions. The result: users don't update their stats, TDEE calculations drift, and the app feels unfinished.

## 2. User Stories

**Primary persona — Active tracker (daily user, updates stats weekly):**
- As an active tracker, I want to edit my weight, body fat %, and activity level directly from my profile, so that my TDEE and macro targets stay accurate without navigating to a separate screen.

**Secondary persona — Goal changer (switches between bulk/cut cycles):**
- As a goal changer, I want to switch my goal type and target weight from the profile, so that my calorie budget adjusts immediately and I can see the new numbers before I start my next meal.

**Secondary persona — New user (just finished onboarding):**
- As a new user, I want the profile to auto-detect my timezone and suggest sensible defaults for region and currency, so that I don't have to hunt through settings to make the app feel localized.

**Edge persona — Cautious deleter:**
- As a user considering account deletion, I want the delete option to exist but not be prominent, so that I don't accidentally trigger it and so that I feel the app respects the gravity of that action.

**Edge persona — Imperial user:**
- As a user who thinks in pounds and feet, I want all body stats and goal targets displayed in imperial units when I've set that preference, so that I never have to do mental math.

## 3. User Flow

### Entry: User taps Profile tab in bottom navigation

```
Profile Tab tap
  → Profile_Screen loads
  → Fetch profile, latest metrics, goals, adaptive targets in parallel
  → Render sections top-to-bottom with staggered entrance animation:

  ┌─────────────────────────────────────────┐
  │ SECTION 1: Profile Header               │
  │  Avatar (initial) · Display Name (edit) │
  │  Email (read-only) · Premium badge      │
  │  Member since: Jan 2024                 │
  └─────────────────────────────────────────┘
  ┌─────────────────────────────────────────┐
  │ SECTION 2: Body Stats                   │
  │  Height: 180 cm  Weight: 82 kg          │
  │  Body Fat: 16%   Activity: Moderate     │
  │  Last updated: 3 days ago               │
  │  [View History →]                       │
  │                                         │
  │  On edit → inline field editing         │
  │  On save → POST /user/metrics           │
  │         → trigger recalculation         │
  │         → show updated TDEE/macros      │
  └─────────────────────────────────────────┘
  ┌─────────────────────────────────────────┐
  │ SECTION 3: Goals                        │
  │  Goal: Cutting  Target: 78 kg           │
  │  Rate: -0.5 kg/week                     │
  │  ── Current Targets ──                  │
  │  2,180 kcal · 180g P · 220g C · 60g F  │
  │                                         │
  │  On edit → inline field editing         │
  │  On save → PUT /user/goals              │
  │         → trigger recalculation         │
  │         → animate target number change  │
  └─────────────────────────────────────────┘
  ┌─────────────────────────────────────────┐
  │ SECTION 4: Preferences                  │
  │  Units: [Metric ○] [○ Imperial]         │
  │  Timezone: America/New_York (auto)      │
  │  Region: US                             │
  │  Currency: USD                          │
  │  Coaching: Coached                      │
  └─────────────────────────────────────────┘
  ┌─────────────────────────────────────────┐
  │ SECTION 5: Features                     │
  │  Coaching · Community · Founder's Story │
  │  Health Reports · Learn · Progress      │
  └─────────────────────────────────────────┘
  ┌─────────────────────────────────────────┐
  │ SECTION 6: Subscription (compact)       │
  │  Status: Active · Renews: Mar 15, 2025  │
  │  [Upgrade to Premium] (if free)         │
  └─────────────────────────────────────────┘
  ┌─────────────────────────────────────────┐
  │ SECTION 7: Account (de-emphasized)      │
  │  [Log Out]                              │
  │  ▸ Danger Zone (collapsed)              │
  │    └─ [Delete Account]                  │
  │  App version: 1.2.0                     │
  └─────────────────────────────────────────┘
```

### Drop-off prevention:
- **Body Stats empty state**: If no metrics exist yet, show a CTA "Add your stats to unlock personalized targets" with a single tap to open the edit flow. Because a blank section with dashes feels broken.
- **Goals empty state**: If no goals are set, show "Set your first goal" CTA that opens the goal editor. Because showing "Not set" for everything signals an unfinished product.
- **Timezone auto-detect**: Pre-fill from device locale on first load so the user never sees "Not set". Because every "Not set" field is a micro-frustration.
- **Save feedback**: Show a brief success indicator (checkmark animation) after each save. Because silent saves feel unreliable.

## 4. Premium Feel

- **Staggered entrance**: Each section fades in with a 60ms stagger (existing `useStaggeredEntrance` hook). Because simultaneous rendering feels flat.
- **Number transitions**: When TDEE/macro targets update after recalculation, animate the number change (count up/down over 300ms). Because instant number swaps feel jarring and users miss the change.
- **Save micro-interaction**: On successful save, the field briefly pulses with the accent color border, then settles. Because it confirms the action without a disruptive toast.
- **Danger Zone expand**: Smooth height animation with a subtle warning color fade-in. Because abrupt show/hide feels cheap.
- **Loading states**: Skeleton placeholders for Body Stats and Goals while fetching. Because empty sections during load look broken.
- **Empty states**: Illustrated empty states with clear CTAs (not just "No data"). Because empty states are the first impression for new users.
- **Copy tone**: Conversational but precise. "Your targets, updated" not "Recalculation complete". Because the app should feel like a coach, not a database.

## 5. Integration Audit

| Existing Flow | What Changes | What Stays | Justification |
|---|---|---|---|
| **ProfileScreen.tsx** | Complete rewrite — new section order, new components, rest timer removed | SafeAreaView wrapper, ScrollView pattern, staggered entrance hook usage | The current screen is the problem; a rewrite is the solution |
| **Store (index.ts)** | Add `goals` and `latestMetrics` state slices, add `setGoals`, `setLatestMetrics` actions | All existing state and actions remain untouched | New state is additive; no existing consumers break |
| **EditableField component** | No changes | Entire component | Already supports the inline edit pattern we need |
| **FeatureNavItem component** | No changes | Entire component | Already renders the nav items correctly |
| **CoachingModeSelector** | No changes — still used in Preferences section | Entire component | Just moves from its own Card to within the Preferences Card |
| **AddTrainingModal / RestTimer** | No changes — rest timer stays in training modal | Rest timer UI and logic | Rest timer was duplicated on profile; removing the duplicate, not the source |
| **PUT /user/profile endpoint** | No changes | Accepts timezone, region, currency, preferences, coaching_mode | Already supports all the fields we need for Preferences |
| **POST /user/metrics endpoint** | No changes to endpoint; frontend now calls it from profile | Append-only metrics logging | Existing endpoint, new call site |
| **PUT /user/goals endpoint** | No changes to endpoint; frontend now calls it from profile | Goal upsert logic | Existing endpoint, new call site |
| **GET /user/goals endpoint** | No changes; frontend now fetches on profile load | Returns current goals | Existing endpoint, new call site |
| **Adaptive engine** | May need a new convenience endpoint that accepts stats+goals and returns targets in one call | Core computation logic unchanged | Avoids multiple round-trips; the engine itself is pure and untouched |
| **UpgradeModal** | No changes | Entire component | Still triggered from Subscription section |
| **Bottom tab navigator** | No changes | Profile tab routing | Screen name stays the same |

## 6. Backward Compatibility

- **No backend breaking changes**: All existing endpoints remain unchanged. New frontend calls existing endpoints from a new call site (profile screen). Users on older app versions continue using the old profile screen with no issues.
- **Store additions are additive**: New state slices (`goals`, `latestMetrics`) default to `null`. Existing code that reads `profile`, `unitSystem`, `coachingMode`, `subscription` is unaffected.
- **Rest timer removal**: The rest timer is already accessible in the AddTrainingModal. Removing it from profile does not remove functionality — it removes duplication. Users who relied on the profile rest timer setting will find it in the training modal where it's contextually appropriate.
- **Feature flag**: Ship behind a `profile_redesign` feature flag. If the flag is off, render the old ProfileScreen. This allows staged rollout and instant rollback.

## 7. Edge Cases

| Edge Case | Design Decision |
|---|---|
| **No metrics exist** (new user, skipped onboarding) | Show empty state with CTA: "Add your body stats to get personalized targets". Tapping opens inline edit mode for all fields. |
| **No goals set** | Show empty state with CTA: "Set your first goal". Tapping opens goal type selector. |
| **No network during save** | Show error inline below the field: "Couldn't save. Check your connection and try again." Retain the edited value in the field so the user doesn't lose their input. |
| **Recalculation fails** | Show error message: "Targets couldn't be updated. Your previous targets are still active." Keep previous adaptiveTargets in store. |
| **Timezone not detectable** | Fall back to UTC. Show timezone picker with "UTC" pre-selected and a note: "We couldn't detect your timezone. Please select it manually." |
| **First-time profile load (no profile record)** | Backend auto-creates a blank profile (existing behavior). Frontend shows empty states for Body Stats and Goals. |
| **Imperial unit edge cases** | Height conversion: store in cm, display as ft′in″. Weight conversion: store in kg, display in lbs. All conversions happen at the display layer only. |
| **Concurrent edits** | Last-write-wins (existing backend behavior). Profile screen fetches fresh data on mount, so stale data is unlikely in single-user context. |
| **Delete account interrupted** | Confirmation dialog prevents accidental deletion. If the API call fails, show error and do not log out. |
| **Feature flag off** | Render the existing ProfileScreen component unchanged. |

## 8. Success Metrics

| Metric | Target | Why |
|---|---|---|
| **Body stats update rate** (% of active users who update stats at least once per month) | Increase from current baseline by 40% within 30 days of rollout | The primary goal is getting users to keep their stats current so TDEE stays accurate |
| **Profile screen engagement time** | Increase median session time on profile by 20% | More useful sections = more time spent configuring = better personalization |
| **Guardrail: Onboarding completion rate** | No decrease (±1%) | Ensures the profile redesign doesn't confuse new users or create redundancy with onboarding |

## 9. Rollout Strategy

1. **Feature flag**: `profile_redesign` — boolean, default off
2. **Internal dogfood**: Enable for team accounts (1 week). Validate no crashes, no data issues.
3. **Staged rollout**: 10% → 25% → 50% → 100% over 2 weeks. Monitor crash rate, API error rate, and body stats update rate at each stage.
4. **Kill switch**: If crash rate increases >0.5% or API error rate increases >2%, disable flag and revert to old screen instantly.
5. **A/B measurement**: Compare body stats update rate between control (old) and treatment (new) during staged rollout.

## 10. What We're NOT Building (v1 Scope)

| Out of Scope | Why |
|---|---|
| **Avatar image upload** | Adds complexity (image storage, cropping, permissions) for low impact. Initial-based avatar is sufficient for v1. |
| **Profile sharing / public profile** | Social features are a separate initiative. Profile is a private settings hub. |
| **Inline metrics charting** | The "View History" link navigates to the existing metrics history screen. Embedding charts in profile adds complexity without clear value. |
| **Goal recommendations / AI suggestions** | The coaching module handles this. Profile is for manual goal setting. |
| **Multi-currency display** | Currency preference is stored but not used for display in v1. Future feature for international pricing. |
| **Dark/light theme toggle** | App is dark-first by design. Theme switching is a separate feature. |
| **Notification preferences** | Belongs in a dedicated notifications settings screen, not profile. |

---

## Glossary

- **Profile_Screen**: The main user profile and settings screen in the HypertrophyOS mobile app
- **Profile_Header**: The top section displaying avatar, display name, email, premium badge, and member-since date
- **Body_Stats_Section**: Section displaying and allowing edits to height, weight, body fat %, and activity level
- **Goals_Section**: Section displaying and allowing edits to goal type, target weight, goal rate, and derived TDEE/macro targets
- **Preferences_Section**: Section containing unit system, timezone, region, currency, and coaching mode settings
- **Features_Navigation**: Section containing navigation links to sub-features
- **Subscription_Section**: Compact section showing subscription status and renewal information
- **Account_Section**: De-emphasized section at the bottom with log out, delete account (behind Danger_Zone), and app version
- **Adaptive_Engine**: Backend computation module that calculates TDEE and macro targets from body stats, goals, and bodyweight history
- **TDEE**: Total Daily Energy Expenditure — estimated daily calorie burn
- **Body_Stats**: Collective term for height_cm, weight_kg, body_fat_pct, and activity_level
- **User_Goals**: goal_type (bulking/cutting/maintaining), target_weight_kg, target_body_fat_pct, goal_rate_per_week
- **Danger_Zone**: Collapsible section hiding destructive actions behind an explicit expand action
- **Recalculation_Trigger**: Process that re-runs the Adaptive_Engine when Body_Stats or User_Goals change
- **Unit_System**: User's preferred measurement system (metric or imperial)
- **Store**: Zustand-based frontend state management

## Requirements

### Requirement 1: Profile Header Display

**User Story:** As a user, I want to see my identity information at the top of the profile screen, so that I can confirm my account and personalize my display name.

#### Acceptance Criteria

1. WHEN the Profile_Screen loads, THE Profile_Header SHALL display the user's avatar initial, display name, email address, and member-since date
2. WHEN the user taps the display name field, THE Profile_Header SHALL allow inline editing of the display name using the EditableField component
3. WHEN the user has an active premium subscription, THE Profile_Header SHALL display a premium badge next to the avatar
4. THE Profile_Header SHALL display the email address as read-only

### Requirement 2: Body Stats Editing and Display

**User Story:** As an active tracker, I want to view and edit my body stats from the profile screen, so that my TDEE and macro targets stay accurate.

#### Acceptance Criteria

1. WHEN the Profile_Screen loads, THE Body_Stats_Section SHALL display the user's current height, weight, body fat percentage, and activity level fetched from the latest UserMetric record
2. WHEN the user edits any body stat field and saves, THE Body_Stats_Section SHALL send the updated metrics to `POST /user/metrics` and trigger a Recalculation_Trigger
3. WHEN a Recalculation_Trigger completes after a body stats change, THE Body_Stats_Section SHALL display the updated TDEE and macro targets returned by the Adaptive_Engine
4. THE Body_Stats_Section SHALL display the last-updated date of the most recent metrics entry
5. WHEN the user taps the "View History" link, THE Body_Stats_Section SHALL navigate to the metrics history screen
6. WHILE the Unit_System is set to imperial, THE Body_Stats_Section SHALL display weight in pounds and height in feet/inches
7. WHEN no metrics exist for the user, THE Body_Stats_Section SHALL display an empty state with a CTA to add body stats

### Requirement 3: Goals Editing and Display

**User Story:** As a goal changer, I want to view and edit my fitness goals from the profile screen, so that my calorie budget adjusts immediately when I switch between bulk/cut cycles.

#### Acceptance Criteria

1. WHEN the Profile_Screen loads, THE Goals_Section SHALL display the user's current goal type, target weight, and goal rate fetched from `GET /user/goals`
2. WHEN the user edits any goal field and saves, THE Goals_Section SHALL send the updated goals to `PUT /user/goals` and trigger a Recalculation_Trigger
3. WHEN a Recalculation_Trigger completes after a goal change, THE Goals_Section SHALL display the updated TDEE and macro targets
4. THE Goals_Section SHALL display the current derived TDEE and macro targets (calories, protein, carbs, fat) below the goal fields
5. WHILE the Unit_System is set to imperial, THE Goals_Section SHALL display target weight in pounds
6. WHEN no goals are set for the user, THE Goals_Section SHALL display an empty state with a CTA to set a first goal

### Requirement 4: Preferences Management

**User Story:** As a new user, I want to manage my locale and app preferences in one place, so that the app respects my timezone, region, currency, unit system, and coaching mode.

#### Acceptance Criteria

1. THE Preferences_Section SHALL display controls for unit system, timezone, region, currency, and coaching mode
2. WHEN the user changes the unit system, THE Preferences_Section SHALL persist the change via `PUT /user/profile` and update the Store immediately
3. WHEN the user selects a timezone, THE Preferences_Section SHALL persist the selection via `PUT /user/profile`
4. WHEN the Profile_Screen loads and timezone is not set, THE Preferences_Section SHALL auto-detect the device timezone and suggest it as the default
5. WHEN the user selects a region, THE Preferences_Section SHALL persist the selection via `PUT /user/profile`
6. WHEN the user selects a currency, THE Preferences_Section SHALL persist the selection via `PUT /user/profile`
7. WHEN the user changes the coaching mode, THE Preferences_Section SHALL persist the change via `PUT /user/profile` and update the Store immediately

### Requirement 5: Features Navigation

**User Story:** As a user, I want quick access to sub-features from the profile screen, so that I can navigate to Coaching, Community, Founder's Story, Health Reports, Learn, and Progress Photos.

#### Acceptance Criteria

1. THE Features_Navigation SHALL display navigation items for Coaching, Community, Founder's Story, Health Reports, Learn, and Progress Photos using the FeatureNavItem component
2. WHEN the user taps a navigation item, THE Features_Navigation SHALL navigate to the corresponding screen

### Requirement 6: Subscription Display

**User Story:** As a user, I want to see my subscription status on the profile screen, so that I know my current plan and renewal date.

#### Acceptance Criteria

1. THE Subscription_Section SHALL display the current subscription status and renewal date in a compact layout
2. WHEN the user does not have a premium subscription, THE Subscription_Section SHALL display an upgrade button
3. WHEN the user taps the upgrade button, THE Subscription_Section SHALL open the UpgradeModal

### Requirement 7: Account Actions and Safety

**User Story:** As a cautious user, I want account actions to be accessible but not prominent, so that I do not accidentally trigger destructive actions.

#### Acceptance Criteria

1. THE Account_Section SHALL be positioned at the bottom of the Profile_Screen with de-emphasized styling
2. THE Account_Section SHALL display a Log Out button with secondary styling
3. THE Account_Section SHALL hide the Delete Account button inside a collapsible Danger_Zone section
4. WHEN the user expands the Danger_Zone, THE Account_Section SHALL reveal the Delete Account button with a destructive style
5. WHEN the user taps Delete Account, THE Account_Section SHALL display a confirmation dialog before proceeding
6. THE Account_Section SHALL display the app version number

### Requirement 8: Rest Timer Removal from Profile

**User Story:** As a user, I want rest timer settings removed from the profile screen, so that training-specific settings are only accessible in the training modal where they are contextually relevant.

#### Acceptance Criteria

1. THE Profile_Screen SHALL NOT display rest timer input fields (compound rest, isolation rest)
2. THE Preferences_Section SHALL NOT include any rest timer configuration controls

### Requirement 9: Recalculation Trigger on Stats or Goals Change

**User Story:** As a user, I want my TDEE and macro targets to update automatically when I change my body stats or goals, so that my nutrition recommendations stay accurate.

#### Acceptance Criteria

1. WHEN the user saves updated Body_Stats, THE Recalculation_Trigger SHALL call the Adaptive_Engine with the new metrics and return updated TDEE and macro targets
2. WHEN the user saves updated User_Goals, THE Recalculation_Trigger SHALL call the Adaptive_Engine with the new goals and return updated TDEE and macro targets
3. WHEN the Recalculation_Trigger returns updated targets, THE Store SHALL update the adaptiveTargets state so all dependent UI sections reflect the new values
4. IF the Recalculation_Trigger fails, THEN THE Profile_Screen SHALL display an error message and retain the previous target values
