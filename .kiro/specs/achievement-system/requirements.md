# Requirements Document

## Introduction

The Achievement System adds gamification to Hypertrophy OS by awarding badges and tracking progress across four domains: personal records (PR badges), consistency streaks, lifetime volume milestones, and nutrition compliance. Achievements are displayed on the user profile, celebrated with in-app modals, and can be shared as visually appealing cards to social media.

## Glossary

- **Achievement_Engine**: The backend service responsible for evaluating achievement unlock conditions, tracking progress, and persisting achievement state.
- **Achievement_Definition**: A static record describing an achievement's unlock criteria, category, tier, icon, and display metadata.
- **User_Achievement**: A record linking a user to an unlocked achievement, including the unlock timestamp.
- **Achievement_Progress**: A record tracking a user's incremental progress toward a locked achievement (e.g., current streak count, cumulative volume).
- **PR_Badge**: An achievement awarded when a user logs a set that meets or exceeds a predefined weight threshold for a specific exercise category.
- **Streak**: A count of consecutive calendar days on which a user has logged at least one training session or nutrition entry.
- **Volume_Milestone**: An achievement awarded when a user's lifetime total volume lifted (sum of weight × reps across all sets) crosses a predefined threshold.
- **Nutrition_Compliance_Badge**: An achievement awarded when a user hits macro targets within a 5% tolerance for a required number of consecutive days.
- **Achievement_Card**: A rendered image or shareable view summarizing an unlocked achievement with visual styling suitable for social media.
- **Celebration_Modal**: A full-screen overlay displayed in the app when a new achievement is unlocked during a session.
- **Achievement_Grid**: A UI component on the profile screen displaying all achievements in a grid layout, with locked achievements shown as grayed-out with progress indicators.
- **Dashboard_Streak_Widget**: A UI component on the dashboard screen showing the user's current streak count.

## Requirements

### Requirement 1: PR Badge Detection

**User Story:** As a lifter, I want to earn badges when I hit strength milestones, so that I can celebrate and track my progress on key lifts.

#### Acceptance Criteria

1. WHEN a training session is saved containing a set where the weight meets or exceeds a PR_Badge threshold, THE Achievement_Engine SHALL unlock the corresponding PR_Badge for the user.
2. THE Achievement_Engine SHALL support the following PR_Badge thresholds: 1-plate bench press (60 kg), 2-plate bench press (100 kg), 3-plate squat (140 kg), 4-plate deadlift (180 kg), 2-plate squat (100 kg), 2-plate deadlift (100 kg), 3-plate bench press (140 kg), 3-plate deadlift (140 kg), 4-plate squat (180 kg), and 5-plate deadlift (220 kg).
3. WHEN a PR_Badge is unlocked, THE Achievement_Engine SHALL record the unlock timestamp and the specific set that triggered the unlock.
4. IF a training session is soft-deleted after triggering a PR_Badge unlock, THEN THE Achievement_Engine SHALL retain the unlocked PR_Badge.
5. WHEN evaluating PR_Badge thresholds, THE Achievement_Engine SHALL match exercise names using case-insensitive comparison and support common aliases (e.g., "Flat Bench Press" matches "Bench Press").

### Requirement 2: Consistency Streak Tracking

**User Story:** As a user, I want to see my current streak of consecutive active days, so that I can stay motivated to log daily.

#### Acceptance Criteria

1. WHEN a user logs a training session or nutrition entry for a calendar day, THE Achievement_Engine SHALL update the user's Streak count.
2. THE Achievement_Engine SHALL define a Streak day as any calendar day (in the user's configured timezone) with at least one training session or nutrition entry.
3. WHEN a user's Streak reaches 7, 30, 90, or 365 consecutive days, THE Achievement_Engine SHALL unlock the corresponding streak achievement.
4. WHEN a user misses a calendar day with no logged activity, THE Achievement_Engine SHALL reset the Streak count to zero.
5. THE Dashboard_Streak_Widget SHALL display the user's current Streak count on the dashboard screen.
6. WHEN the Streak count changes, THE Dashboard_Streak_Widget SHALL update without requiring a full page reload.

### Requirement 3: Volume Milestone Tracking

**User Story:** As a lifter, I want to earn badges for lifetime volume milestones, so that I can see my cumulative effort recognized.

#### Acceptance Criteria

1. WHEN a training session is saved, THE Achievement_Engine SHALL add the session's total volume (sum of weight_kg × reps for each set) to the user's lifetime volume total.
2. WHEN the user's lifetime volume total reaches 10,000 kg, 50,000 kg, 100,000 kg, 500,000 kg, or 1,000,000 kg, THE Achievement_Engine SHALL unlock the corresponding Volume_Milestone achievement.
3. IF a training session is soft-deleted, THEN THE Achievement_Engine SHALL subtract the session's volume from the lifetime total but SHALL NOT revoke previously unlocked Volume_Milestone achievements.
4. THE Achievement_Progress for volume milestones SHALL store the current lifetime total so progress can be displayed without re-scanning all sessions.

### Requirement 4: Nutrition Compliance Badges

**User Story:** As a user tracking macros, I want to earn badges for consistently hitting my targets, so that I feel rewarded for dietary discipline.

#### Acceptance Criteria

1. WHEN a user's daily nutrition totals are within 5% of each macro target (calories, protein, carbs, fat) for a calendar day, THE Achievement_Engine SHALL count that day as compliant.
2. WHEN a user achieves 7, 14, or 30 consecutive compliant days, THE Achievement_Engine SHALL unlock the corresponding Nutrition_Compliance_Badge.
3. WHEN a non-compliant day occurs, THE Achievement_Engine SHALL reset the consecutive compliance counter to zero.
4. THE Achievement_Engine SHALL evaluate compliance using the user's adaptive targets from the most recent adaptive snapshot for each day.

### Requirement 5: Achievement Display on Profile

**User Story:** As a user, I want to see all my achievements on my profile, so that I can review my accomplishments and see what I still need to unlock.

#### Acceptance Criteria

1. THE Achievement_Grid SHALL display all Achievement_Definitions grouped by category (PR Badges, Streaks, Volume Milestones, Nutrition Compliance).
2. WHEN an achievement is unlocked, THE Achievement_Grid SHALL display the achievement with its full-color icon and unlock date.
3. WHEN an achievement is locked, THE Achievement_Grid SHALL display the achievement as grayed-out with a progress indicator showing current progress toward the unlock threshold.
4. WHEN the user navigates to the profile screen, THE Achievement_Grid SHALL load achievement data from the API and display a loading skeleton during fetch.

### Requirement 6: Shareable Achievement Cards

**User Story:** As a user, I want to share my achievements on social media, so that I can celebrate milestones with my community.

#### Acceptance Criteria

1. WHEN a user taps a share button on an unlocked achievement, THE system SHALL generate an Achievement_Card containing the achievement icon, title, description, unlock date, and app branding.
2. THE Achievement_Card SHALL be rendered as a shareable image or view compatible with the platform's native share sheet (iOS/Android).
3. WHEN the share action completes or is cancelled, THE system SHALL return the user to the achievement view without data loss.

### Requirement 7: Achievement Unlock Notifications

**User Story:** As a user, I want to see a celebration when I unlock a new achievement, so that the moment feels special and rewarding.

#### Acceptance Criteria

1. WHEN a training session or nutrition entry triggers an achievement unlock, THE API response SHALL include the list of newly unlocked achievements.
2. WHEN the frontend receives newly unlocked achievements in an API response, THE Celebration_Modal SHALL display with the achievement icon, title, and a congratulatory message.
3. WHEN the user dismisses the Celebration_Modal, THE system SHALL return to the previous screen state without data loss.
4. IF multiple achievements are unlocked simultaneously, THEN THE Celebration_Modal SHALL display them sequentially, one at a time.

### Requirement 8: Achievement Data API

**User Story:** As a developer, I want a clean API for achievement data, so that the frontend can efficiently fetch and display achievement state.

#### Acceptance Criteria

1. THE Achievement_Engine SHALL expose a GET endpoint returning all Achievement_Definitions with the user's unlock status and progress for each.
2. THE Achievement_Engine SHALL expose a GET endpoint returning only the user's unlocked achievements with timestamps.
3. WHEN achievement data is requested, THE Achievement_Engine SHALL scope all queries to the authenticated user's ID.
4. THE API responses SHALL use the existing paginated response format consistent with other modules.
5. THE Achievement_Engine SHALL serialize Achievement_Definition and User_Achievement data using Pydantic schemas consistent with the existing codebase patterns.
