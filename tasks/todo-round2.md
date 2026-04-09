# Bug Fixes & Polish Plan — Round 2

## Phase 1: Critical Bugs

### 1. Plateau card buttons not working
- **Root cause**: "Take Action" → `console.warn` stub. "Dismiss" → local state only, not persisted
- **File**: `app/screens/dashboard/DashboardScreen.tsx:264`
- **Fix**: 
  - "Take Action" → navigate to relevant screen based on `nudge.action` (e.g., plateau → nutrition preferences)
  - "Dismiss" → persist to AsyncStorage so it doesn't reappear on reload

### 2. Recalculate API 500 error
- **Root cause**: Likely invalid enum value (`GoalType` or `ActivityLevel`) or edge case in `compute_snapshot()` math (division by zero with 0 height)
- **File**: `src/modules/user/service.py:289-433`
- **Fix**: Add defensive checks — validate enum values before constructing, handle 0 height/weight, wrap `compute_snapshot()` in try/except with meaningful error

### 3. Notification toggles not working
- **Root cause**: Toggles ARE wired to API (`api.patch('notifications/preferences')`). If they're not working, the backend endpoint may be failing silently. Need to verify the endpoint exists and works.
- **File**: `app/screens/settings/NotificationSettingsScreen.tsx`
- **Fix**: Verify backend endpoint, check if the error is swallowed

## Phase 2: Content & Features

### 4. Learn section — no articles
- **Root cause**: dev.db was recreated but seed scripts were never run
- **Fix**: Run `scripts/seed_research_articles.py` and `scripts/seed_wns_articles.py` against dev.db

### 5. Coaching tab — no premium gate on navigation
- **Root cause**: The coaching nav item is accessible to all users, but the content is premium-only
- **File**: `app/screens/profile/ProfileScreen.tsx:206`
- **Fix**: Add premium check — if not premium, show upgrade prompt instead of navigating to coaching

### 6. Send Test Notification — web limitation
- **Root cause**: Uses `expo-notifications` `scheduleNotificationAsync` which only works on native (iOS/Android), not web
- **Fix**: On web, show an alert explaining push notifications require the mobile app. On native, it already works.

## Phase 3: UI Polish

### 7. Unit system wording — "Metric" / "Imperial" confusing
- **Root cause**: Technical terms that non-fitness users may not understand
- **Fix**: Change to "kg, cm" / "lbs, ft" or "Metric (kg, cm)" / "Imperial (lbs, ft)"

### 8. Notification toggles — premiumize the UI
- **Root cause**: Basic React Native `<Switch>` components
- **Fix**: Style the switches with themed colors, add subtle animations, improve the card layout

### 9. Data export — verify the flow works
- **Root cause**: Fully implemented but untested after DB recreation
- **Fix**: Test the flow end-to-end, fix any issues found
