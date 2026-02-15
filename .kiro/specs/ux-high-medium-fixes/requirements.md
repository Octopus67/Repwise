# HIGH + MEDIUM UX Fixes — Requirements

## Context
The critical UX fixes spec addressed blockers (date-aware logging, forgot password, error boundary, etc.). This spec covers the HIGH and MEDIUM priority issues from the same UX audit — friction points, missing polish, and usability gaps that degrade the experience but don't fully block users.

## User Stories

### US-1: Password Visibility Toggle
As a user, I want to toggle password visibility on login and register forms so I can verify what I typed.

Acceptance Criteria:
- Login password field has an eye icon toggle that shows/hides the password
- Register password and confirm password fields each have eye icon toggles
- ForgotPasswordScreen (if it has a new password field) also has the toggle
- Toggle icon switches between eye-open and eye-closed states

### US-2: Onboarding Step Counter
As a user going through onboarding, I want to see "Step X of Y" so I know how far along I am.

Acceptance Criteria:
- OnboardingWizard shows "Step {currentStep} of 10" text near the progress bar
- Text updates as user advances through steps

### US-3: Remove IntentStep Auto-Advance
As a user, I don't want to be auto-advanced to the next onboarding step when I tap a goal — I want to confirm my choice first.

Acceptance Criteria:
- IntentStep no longer calls `setTimeout(onNext, 200)` on selection
- User must tap "Next" button to advance (add a Next button to IntentStep)
- Selected goal is visually highlighted with a checkmark

### US-4: Input Field Chaining on Auth Screens
As a user, I want the keyboard "Next" button to move focus between fields and "Done" to submit the form.

Acceptance Criteria:
- Login: Email has `returnKeyType="next"` focusing password; Password has `returnKeyType="done"` triggering login
- Register: Email → Password → Confirm Password chain with `returnKeyType="next"`; Confirm Password has `returnKeyType="done"` triggering register
- Uses `ref` forwarding to focus next input

### US-5: DateScroller "Jump to Today" Button
As a user, I want a quick way to return to today's date after scrolling to past dates.

Acceptance Criteria:
- When `selectedDate !== today`, a small "Today" pill/button appears near the DateScroller
- Tapping it sets `selectedDate` back to today and scrolls the DateScroller to the current week
- Button is hidden when already on today

### US-6: Logs Screen Date Filtering
As a user, I want to filter my nutrition and training logs by date so I can review past entries.

Acceptance Criteria:
- LogsScreen uses the store's `selectedDate` to filter entries (synced with Dashboard's DateScroller)
- Nutrition tab shows entries for the selected date (not hardcoded last 7 days)
- Training tab shows sessions for the selected date range
- A DateScroller or date display appears at the top of LogsScreen

### US-7: Post-Save Rapid Logging in Nutrition Modal
As a user logging multiple food items, I want the modal to clear and stay open after saving so I can log the next item immediately.

Acceptance Criteria:
- After successful save, the "Save as Favorite" prompt becomes optional (small inline link, not a full-screen takeover)
- Form fields clear after save
- Modal stays open for the next entry
- A "Done" button closes the modal when user is finished
- Success feedback: brief inline "Logged ✓" text or toast, not a screen replacement

### US-8: Learn Screen Search
As a user, I want to search articles by keyword so I can find specific topics.

Acceptance Criteria:
- LearnScreen has a search TextInput above the filter pills
- Search is debounced (300ms) and filters articles by title match
- Search query is sent as a `q` param to the articles API
- Clear button (X) resets search
- Empty search shows all articles (filtered by category if selected)

### US-9: Consistent Empty States
As a developer, I want all screens to use the shared EmptyState component instead of plain Text for empty/no-data states.

Acceptance Criteria:
- CoachingScreen "No coaching requests yet" and "No coaching sessions yet" use EmptyState component
- HealthReportsScreen "No health reports yet" uses EmptyState component
- Consistent icon, title, description pattern across all empty states

### US-10: Remove Placeholder Upload Buttons
As a user, I don't want to see buttons that say "coming soon" when I tap them — it erodes trust.

Acceptance Criteria:
- CoachingScreen: Remove "Upload Document" button from each request card (or disable with tooltip "Coming soon")
- HealthReportsScreen: Replace "Upload New Report" button with a disabled state + "Coming soon" subtitle
- No `Alert.alert` with "coming soon" messages on tap

### US-11: Favorites Filter in Learn Screen
As a user, I want to filter articles to show only my favorites.

Acceptance Criteria:
- Add "Favorites" as a filter pill option (after "All" and before category pills)
- When "Favorites" is selected, show only articles in the user's favorites set
- Star icon on the pill to differentiate it from category filters

### US-12: Article Card Preview Text
As a user, I want to see a brief excerpt on article cards so I can decide what to read.

Acceptance Criteria:
- Article cards in LearnScreen show a 1-2 line excerpt/summary below the title
- Excerpt comes from the article's `content_markdown` (first ~100 chars, stripped of markdown)
- If no content available, show tags as fallback (current behavior)

### US-13: Nutrition Report Age/Sex from Profile
As a user, I want the Nutrition Report to use my actual age and sex for RDA calculations instead of hardcoded defaults.

Acceptance Criteria:
- NutritionReportScreen reads birth year and sex from the onboarding store or user profile
- If available, uses real values for RDA calculations
- If not available, keeps current defaults with the warning banner
- "Set Profile" link navigates to onboarding or a profile edit screen that has age/sex fields
