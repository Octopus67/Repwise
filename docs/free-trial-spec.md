# Free Trial Business Logic Specification

## Overview
14-day free trial of premium features to drive trial-to-paid conversion.

## Rules
- **Duration**: 14 calendar days from activation
- **Eligibility**: One trial per user, ever (`has_used_trial` flag on users table)
- **No charge**: Trial creates a subscription with `is_trial=True`, no payment provider call
- **Auto-downgrade**: Hourly job expires trials past `trial_ends_at`
- **Premium access**: Trial subscriptions grant full premium access (status=active)
- **Insights**: On day 14, show user what they accomplished during trial

## Database Changes
### users table
- `has_used_trial: Boolean, default=False` — prevents repeat trials
- `trial_started_at: DateTime(tz), nullable` — when trial began
- `trial_ends_at: DateTime(tz), nullable` — when trial expires

### subscriptions table
- `is_trial: Boolean, default=False` — distinguishes trial from paid

## Trial Lifecycle
1. User requests trial → check `has_used_trial == False`
2. Set `has_used_trial=True`, `trial_started_at=now`, `trial_ends_at=now+14d`
3. Create subscription: `status=active, is_trial=True`
4. User enjoys premium for 14 days
5. Hourly job finds expired trials → set subscription `status=cancelled`, then `status=free`
6. User prompted to upgrade with insights summary

## Trial Insights (computed at query time)
- Workouts logged during trial period
- Personal records (PRs) hit
- Total volume lifted (kg)
- Meals logged
- Measurements tracked

## API Endpoints
- `GET /api/v1/trial/eligibility` — check if user can start trial
- `POST /api/v1/trial/start` — activate trial
- `GET /api/v1/trial/status` — current trial status + days remaining
- `GET /api/v1/trial/insights` — trial period activity summary

## Frontend Components
- **TrialBadge**: Header badge showing "X days left"
- **TrialCountdown**: Detailed countdown with progress bar
- **TrialExpirationModal**: Day 14 modal with insights + upgrade CTA
- **UpgradeModal**: Modified to show "Start 14-Day Free Trial" for eligible users
- **Onboarding**: Trial prompt after onboarding completion

## Notifications
- Day 7: "You're halfway through your trial!"
- Day 13: "Last day of your trial tomorrow"
- Day 14: "Your trial ends today — upgrade to keep premium"
