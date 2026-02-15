# Critical UX Fixes — Requirements

## Context
UX audit identified critical issues across auth, dashboard, logging, analytics, and navigation that block users, cause data integrity problems, or make core features undiscoverable.

## User Stories

### US-1: Date-Aware Logging
As a user, I want all logging modals (nutrition, training, bodyweight) to respect the date I selected on the DateScroller, so my entries are recorded on the correct date.

Acceptance Criteria:
- AddNutritionModal uses the store's `selectedDate` instead of hardcoded `new Date()`
- AddTrainingModal uses the store's `selectedDate` for `session_date`
- AddBodyweightModal uses the store's `selectedDate` for `recorded_date`
- QuickAddModal receives and uses the selected date (already has `targetDate` prop — verify it's wired correctly)
- MealBuilder uses the store's `selectedDate`

### US-2: Quick Actions Above the Fold
As a user, I want the Quick Log buttons (Log Food, Training, Bodyweight) to be immediately visible when I open the dashboard, so I can start logging without scrolling.

Acceptance Criteria:
- Quick Actions section moves above the macro rings / analytics sections
- Quick Actions appear directly after the date scroller and day badge
- Macro rings, budget bar, meal slot diary, and summary sections follow below

### US-3: Forgot Password Flow
As a user, I want to reset my password via email if I forget it, so I'm not locked out of my account.

Acceptance Criteria:
- LoginScreen shows a "Forgot Password?" link below the password field
- Tapping it shows an email input + "Send Reset Link" button
- Backend endpoint `POST /auth/forgot-password` accepts email and returns success (even if email not found, for security)
- Backend endpoint `POST /auth/reset-password` accepts token + new password
- ForgotPasswordScreen shows success message after submission
- Email validation on the forgot password form

### US-4: Email Validation on Auth Forms
As a user, I want inline email format validation on login and register forms, so I get clear feedback before submitting.

Acceptance Criteria:
- Login and Register screens validate email format client-side before API call
- Invalid email shows inline error "Please enter a valid email address"
- Validation uses standard email regex pattern
- Error clears when user starts typing again

### US-5: Terms of Service Acceptance
As a user, I must accept Terms of Service and Privacy Policy before registering, so the app meets legal requirements.

Acceptance Criteria:
- RegisterScreen shows a checkbox with "I agree to the Terms of Service and Privacy Policy"
- Terms and Privacy links open in-app browser or external URL
- Register button is disabled until checkbox is checked
- Checkbox state is validated before API call

### US-6: Analytics Screen Segmentation
As a user, I want analytics organized into tabs (Nutrition, Training, Body), so I can focus on one area without scrolling through 14+ charts.

Acceptance Criteria:
- Analytics screen has 3 tab pills at the top: Nutrition, Training, Body
- Nutrition tab: calorie trend, protein trend, weekly summary, dietary gaps, target vs actual, nutrition report link
- Training tab: volume trend, strength progression, e1RM trend, muscle heat map, fatigue, strength standards/leaderboard
- Body tab: bodyweight trend, readiness trend, periodization calendar, expenditure trend (TDEE)
- Time range selector appears within each tab and controls only that tab's charts
- Weekly report link visible on all tabs

### US-7: Learn Section Discoverability
As a user, I want to find educational articles without navigating 3 levels deep into Profile, so I can learn while using the app.

Acceptance Criteria:
- Featured articles section on Dashboard links to full Learn screen
- "See All Articles →" link at the end of the featured articles horizontal scroll
- Tapping any article card on Dashboard navigates to ArticleDetail (already works)
- Consider: Add "Learn" as a section header on Dashboard that's tappable

### US-8: Error Boundary
As a user, I want to see a friendly error screen instead of a white screen if something crashes, so I can recover.

Acceptance Criteria:
- App.tsx wraps the main content in a React error boundary
- Error boundary shows "Something went wrong" with a "Restart" button
- Restart button reloads the app state
- Error is logged (console.error at minimum)

### US-9: Back Navigation on Secondary Screens
As a user, I want a back button on every screen I navigate to from Profile, so I can return without relying on gestures.

Acceptance Criteria:
- CoachingScreen has a back button header
- CommunityScreen has a back button header
- HealthReportsScreen has a back button header
- FounderStoryScreen has a back button header
- Back button uses consistent "← Back" pattern matching ArticleDetailScreen

### US-10: Splash/Loading Screen
As a user, I want to see a branded loading screen while the app restores my session, instead of a blank white screen.

Acceptance Criteria:
- App.tsx shows a loading view with app name and spinner while `ready` is false
- Loading view uses the app's dark theme colors
- Smooth transition from loading to main content
