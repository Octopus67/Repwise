# Requirements Document

## Introduction

HypertrophyOS is an adaptive macro and strength-optimization platform for serious lifters. The system integrates adaptive energy modeling, training-integrated nutrition with both macro and micro-nutrient tracking, an educational knowledge hub, premium coaching, founder branding, community engagement, and multi-region payment support. The platform follows a freemium model where core features are available to all users and advanced features are gated behind a premium subscription. Target markets are the US and India, with extensibility for future localization.

## Glossary

- **Platform**: The HypertrophyOS backend and frontend system as a whole
- **User**: A registered individual using HypertrophyOS
- **Adaptive_Engine**: The subsystem that computes and adjusts macro and caloric targets based on physiological data, training load, and user goals
- **Nutrition_Tracker**: The subsystem responsible for logging and retrieving daily nutrition entries including macros and micro-nutrients
- **Training_Tracker**: The subsystem responsible for logging and retrieving training sessions
- **Payment_Gateway**: An abstraction layer over third-party payment providers (Stripe, Razorpay, PayPal)
- **Content_System**: The subsystem managing educational articles, categories, tags, and premium content
- **Coaching_System**: The subsystem managing coaching requests, sessions, plans, and coach profiles
- **Auth_Service**: The subsystem handling user authentication via email/password and social OAuth providers, JWT issuance, and token refresh
- **Admin**: A privileged user role with access to content management and system configuration
- **Premium_User**: A user with an active paid subscription granting access to gated features
- **Free_User**: A user without an active paid subscription, with access to core (non-gated) features only
- **Feature_Flag_Service**: The subsystem that controls runtime feature toggles and freemium gating
- **API_Gateway**: The versioned RESTful API layer exposing all platform functionality
- **Founder_Story_Module**: The public-facing subsystem for the founder's transformation narrative, media, and community links
- **Analytics_Service**: The subsystem integrating with PostHog for event tracking and metrics
- **Food_Database**: The subsystem storing food items, recipes, and their nutritional profiles (macros and micros), with emphasis on Indian food items
- **Health_Report_Service**: The subsystem for uploading, parsing, and analyzing blood reports and lipid profiles against standard health guidelines
- **Meal_Library**: The subsystem managing user-created custom meals and favorite meals for quick logging
- **Dietary_Analysis_Service**: The subsystem that analyzes nutrition trends over configurable time windows to identify nutritional gaps
- **Community_Module**: The subsystem providing community links (Telegram, email) and social engagement features

## Requirements

### Requirement 1: User Registration and Authentication

**User Story:** As a user, I want to register and securely authenticate using email or social login, so that I can access my personalized data and features with minimal friction.

#### Acceptance Criteria

1. WHEN a user submits valid email and password registration data, THE Auth_Service SHALL create a new User record and return a short-lived JWT access token and a refresh token
2. WHEN a user initiates Google OAuth login, THE Auth_Service SHALL authenticate via Google, create or link the User record, and return a JWT access token and refresh token
3. WHEN a user initiates Apple OAuth login, THE Auth_Service SHALL authenticate via Apple, create or link the User record, and return a JWT access token and refresh token
4. WHEN a user submits valid email/password login credentials, THE Auth_Service SHALL issue a short-lived JWT access token and a refresh token
5. WHEN a JWT access token expires, THE Auth_Service SHALL allow the user to obtain a new access token using a valid refresh token
6. IF a user submits invalid or missing registration fields, THEN THE Auth_Service SHALL return a descriptive validation error without creating a User record
7. IF a user submits incorrect login credentials, THEN THE Auth_Service SHALL return an authentication error and increment a rate-limit counter
8. WHEN the rate-limit counter for a user exceeds the configured threshold, THE Auth_Service SHALL temporarily block further login attempts for that user
9. THE Auth_Service SHALL support adding additional social OAuth providers (Facebook, GitHub) in the future without requiring changes to the core authentication flow

### Requirement 2: User Profile and Physiological Data Management

**User Story:** As a user, I want to manage my profile and physiological data, so that the platform can personalize my nutrition and training recommendations.

#### Acceptance Criteria

1. WHEN a user updates their profile information, THE Platform SHALL persist the changes to the UserProfiles record and return the updated profile
2. WHEN a user submits new physiological metrics (height, weight, body fat percentage, activity level), THE Platform SHALL store the metrics in UserMetrics with a timestamp
3. WHEN a user logs a bodyweight entry, THE Platform SHALL append the entry to BodyweightLogs with the recorded date
4. WHEN a user sets or updates goals (target weight, target body fat, goal type), THE Platform SHALL persist the goals in UserGoals
5. THE Platform SHALL retain the full history of UserMetrics and BodyweightLogs entries without overwriting previous records

### Requirement 3: Nutrition Tracking with Macro and Micro-Nutrients

**User Story:** As a user, I want to log and review my daily nutrition including both macros and micro-nutrients, so that I can track my complete nutritional intake over time.

#### Acceptance Criteria

1. WHEN a user submits a nutrition entry (meal name, calories, protein, carbs, fat, and optional micro-nutrients such as fiber, sodium, iron, calcium, vitamins), THE Nutrition_Tracker SHALL persist the entry in NutritionEntries
2. WHEN a user requests nutrition logs for a date range, THE Nutrition_Tracker SHALL return paginated entries filtered by the specified range
3. WHEN a user edits an existing nutrition entry, THE Nutrition_Tracker SHALL update the record and preserve an audit trail
4. WHEN a user deletes a nutrition entry, THE Nutrition_Tracker SHALL soft-delete the record so it remains recoverable
5. IF a nutrition entry contains invalid values (negative numbers or non-numeric fields), THEN THE Nutrition_Tracker SHALL reject the entry with a descriptive error
6. THE Nutrition_Tracker SHALL store micro-nutrient data in an extensible format (JSONB) so that new micro-nutrient fields can be added without schema migration

### Requirement 4: Custom Meals and Favorites

**User Story:** As a user, I want to create custom meals and save favorites, so that I can quickly log frequently eaten meals without re-entering all the data.

#### Acceptance Criteria

1. WHEN a user creates a custom meal with a name and manually entered macro and micro-nutrient values, THE Meal_Library SHALL persist the meal to the user's custom meal collection
2. WHEN a user marks a meal (custom or from the Food_Database) as a favorite, THE Meal_Library SHALL persist the favorite association for that user
3. WHEN a user requests their favorites list, THE Meal_Library SHALL return all favorited meals for that user
4. WHEN a user logs a meal from their favorites or custom meals, THE Nutrition_Tracker SHALL pre-fill the nutrition entry with the saved values
5. WHEN a user edits a custom meal definition, THE Meal_Library SHALL update the definition without altering previously logged nutrition entries that referenced it

### Requirement 5: Indian Food Database and Recipes

**User Story:** As an Indian user, I want access to a database of Indian food items and recipes with nutritional data, so that I can accurately log my meals.

#### Acceptance Criteria

1. THE Food_Database SHALL contain a curated collection of Indian food items with macro-nutrient and micro-nutrient profiles
2. WHEN a user searches the Food_Database by name or keyword, THE Food_Database SHALL return matching food items with their nutritional profiles
3. THE Food_Database SHALL support recipe entries that aggregate nutritional values from constituent ingredients
4. WHEN a user selects a food item or recipe from the Food_Database, THE Nutrition_Tracker SHALL pre-fill a nutrition entry with the item's nutritional values
5. THE Food_Database SHALL support Admin-managed additions and updates to food items without requiring schema changes
6. THE Food_Database SHALL store nutritional data in an extensible format to accommodate future additions of regional cuisines

### Requirement 6: Training Session Tracking

**User Story:** As a user, I want to log and review my training sessions, so that I can monitor my strength progress and training volume.

#### Acceptance Criteria

1. WHEN a user submits a training session (exercises, sets, reps, weight, RPE, date), THE Training_Tracker SHALL persist the session in TrainingSessions
2. WHEN a user requests training history for a date range, THE Training_Tracker SHALL return paginated sessions filtered by the specified range
3. WHEN a user edits an existing training session, THE Training_Tracker SHALL update the record and preserve an audit trail
4. WHEN a user deletes a training session, THE Training_Tracker SHALL soft-delete the record
5. THE Training_Tracker SHALL store exercise data in a structured format that supports future extension with new exercise metadata fields

### Requirement 7: Adaptive Energy Engine

**User Story:** As a user, I want the platform to adaptively calculate my macro and caloric targets, so that my nutrition plan adjusts to my real-world progress and training load.

#### Acceptance Criteria

1. WHEN a user requests an adaptive snapshot, THE Adaptive_Engine SHALL compute caloric and macro targets based on the user's current metrics, goals, recent bodyweight trend, and recent training load
2. WHEN an adaptive snapshot is generated, THE Adaptive_Engine SHALL persist it in AdaptiveSnapshots with a timestamp and the input parameters used
3. WHEN a user's bodyweight trend or training load changes significantly, THE Adaptive_Engine SHALL flag that a recalculation is recommended
4. THE Adaptive_Engine SHALL retain all historical snapshots so users can review how their targets evolved over time
5. THE Adaptive_Engine SHALL produce deterministic outputs given identical input parameters

### Requirement 8: Health Reports and Lipid Profile Analysis

**User Story:** As a user, I want to upload my blood reports and lipid profiles, so that the platform can cross-reference my health markers against standard guidelines and my nutrition data.

#### Acceptance Criteria

1. WHEN a user uploads a blood report (as a PDF or structured data entry), THE Health_Report_Service SHALL parse and store the key markers (e.g., total cholesterol, LDL, HDL, triglycerides, hemoglobin, vitamin D, B12, iron)
2. WHEN a health report is stored, THE Health_Report_Service SHALL validate each marker against standard reference ranges and flag markers that are outside normal bounds
3. WHEN markers are flagged as abnormal, THE Health_Report_Service SHALL cross-reference the user's recent nutrition logs to identify potential dietary correlations (e.g., low iron intake correlating with low hemoglobin)
4. WHEN a user requests their health report history, THE Health_Report_Service SHALL return all stored reports with marker values and flag statuses in chronological order
5. THE Health_Report_Service SHALL support sample/demo reports so users can explore the feature before uploading their own data
6. THE Health_Report_Service SHALL store marker definitions and reference ranges in a configurable format so new markers can be added without schema changes

### Requirement 9: Dietary Trend Analysis

**User Story:** As a user, I want to see analysis of my dietary trends over weeks, so that I can identify nutritional gaps and improve my eating habits.

#### Acceptance Criteria

1. WHEN a user requests a dietary trend analysis for a specified time window (e.g., 1 week, 2 weeks, 4 weeks), THE Dietary_Analysis_Service SHALL aggregate the user's nutrition entries over that period
2. WHEN aggregating nutrition data, THE Dietary_Analysis_Service SHALL compute average daily intake for each tracked macro and micro-nutrient
3. WHEN average intake for a nutrient falls below the recommended daily values (sourced from a configurable reference table of standard dietary guidelines), THE Dietary_Analysis_Service SHALL flag it as a nutritional gap with the deficit percentage
4. THE Dietary_Analysis_Service SHALL present trend data as an array of daily nutrient summaries suitable for chart visualization (one entry per day in the time window)
5. WHERE the user is a Premium_User, THE Dietary_Analysis_Service SHALL provide detailed gap analysis with specific food recommendations from the Food_Database

### Requirement 10: Subscription and Payment Management (Freemium Model)

**User Story:** As a user, I want to subscribe to premium features using my preferred payment method and currency, so that I can unlock coaching, premium content, advanced analytics, and detailed dietary analysis.

#### Acceptance Criteria

1. WHEN a user initiates a subscription, THE Payment_Gateway SHALL delegate to the appropriate provider (Stripe, Razorpay, or PayPal) based on the user's region and currency
2. WHEN a payment provider confirms a subscription, THE Platform SHALL create a Subscription record decoupled from the provider, storing provider_name, provider_subscription_id, provider_customer_id, currency, and region
3. WHEN a webhook event is received from a payment provider, THE Payment_Gateway SHALL verify the webhook signature before processing the event
4. WHEN a user cancels a subscription, THE Payment_Gateway SHALL invoke the provider's cancellation API and update the Subscription record status
5. WHEN a refund is requested, THE Payment_Gateway SHALL invoke the provider's refund API and record the transaction in PaymentTransactions
6. THE Payment_Gateway SHALL implement a PaymentProvider interface with createSubscription, verifyWebhook, cancelSubscription, and refund methods
7. THE Platform SHALL support USD pricing via Stripe and INR pricing via Razorpay, with UPI as a payment method for Indian users
8. IF a webhook signature verification fails, THEN THE Payment_Gateway SHALL reject the event and log the failure for audit
9. THE Platform SHALL enforce freemium gating: core features (basic nutrition logging, basic training logging, free content, community access) are available to Free_Users; premium features (coaching, premium content, detailed dietary analysis, health report cross-referencing) are gated behind an active subscription

### Requirement 11: Educational Content System

**User Story:** As a user, I want to browse and read educational content on training science and nutrition, so that I can deepen my knowledge and improve my results.

#### Acceptance Criteria

1. WHEN a user requests the content catalog, THE Content_System SHALL return a paginated list of ContentArticles filterable by category and tags
2. WHEN a user requests a specific article, THE Content_System SHALL return the full article content in Markdown format
3. THE Content_System SHALL support embedded YouTube links and internal cross-references within article content
4. WHEN an article is marked as premium-only, THE Content_System SHALL restrict access to Premium_Users
5. WHEN a Free_User attempts to access a premium-only article, THE Content_System SHALL return an access-denied response indicating the premium requirement
6. THE Content_System SHALL organize articles under ContentModules (categories) that can be added without database schema changes
7. THE Content_System SHALL support draft and published states for articles, with version history
8. WHEN a user saves an article to favorites, THE Content_System SHALL persist the association and allow retrieval of the user's saved articles

### Requirement 12: Coaching System

**User Story:** As a premium user, I want to request and participate in 1:1 coaching sessions, so that I can receive personalized guidance on my training and nutrition.

#### Acceptance Criteria

1. WHEN a Premium_User submits a coaching request with goals and progress data, THE Coaching_System SHALL create a CoachingRequest with a pending status
2. WHEN a coaching request is approved, THE Coaching_System SHALL transition the request status to approved and create a CoachingSession
3. WHEN a coaching session is completed, THE Coaching_System SHALL transition the session status to completed and store session notes
4. THE Coaching_System SHALL verify that the requesting user has an active premium subscription before accepting a coaching request
5. THE Coaching_System SHALL support document uploads attached to coaching requests and sessions
6. THE Coaching_System SHALL store CoachProfiles as a separate entity to support future multi-coach expansion
7. WHEN a non-premium user attempts to submit a coaching request, THE Coaching_System SHALL reject the request with a descriptive error indicating the premium requirement

### Requirement 13: Founder Story and Community Module

**User Story:** As a visitor or user, I want to read the founder's transformation story and connect with the community, so that I can build trust in the platform and engage with like-minded lifters.

#### Acceptance Criteria

1. WHEN a user or visitor requests the founder story page, THE Founder_Story_Module SHALL return the transformation timeline, narrative text, before/after metrics, and philosophy content
2. WHEN an Admin updates the founder story content, THE Founder_Story_Module SHALL persist the changes and make them immediately available
3. THE Founder_Story_Module SHALL support an optional media gallery with images
4. THE Founder_Story_Module SHALL store content in a format that supports future localization into multiple languages
5. THE Community_Module SHALL display links to the Telegram community group and a contact email address, configurable by an Admin without code changes
6. THE Community_Module SHALL be accessible to both Free_Users and Premium_Users

### Requirement 14: API Design and Versioning

**User Story:** As a developer, I want a well-structured versioned API, so that I can integrate with the platform reliably and without breaking changes.

#### Acceptance Criteria

1. THE API_Gateway SHALL expose all endpoints under a versioned path prefix (/api/v1/)
2. THE API_Gateway SHALL require JWT authentication on all protected endpoints
3. THE API_Gateway SHALL support role-based access control distinguishing at minimum between User, Premium_User, and Admin roles
4. WHEN a list endpoint is called, THE API_Gateway SHALL support pagination parameters (page, limit) and return total count metadata
5. WHEN a list endpoint supports filtering, THE API_Gateway SHALL accept filter parameters and return only matching records
6. THE API_Gateway SHALL validate all request inputs and return structured error responses with appropriate HTTP status codes
7. THE API_Gateway SHALL apply rate limiting to all endpoints to prevent abuse

### Requirement 15: Database Extensibility and Data Integrity

**User Story:** As a developer, I want the database schema to be extensible and maintain data integrity, so that new features can be added without destructive migrations.

#### Acceptance Criteria

1. THE Platform SHALL use soft deletion (a deleted_at timestamp) for all primary entities instead of hard deletion
2. THE Platform SHALL use JSONB columns for fields that are expected to evolve over time (e.g., micro-nutrients, exercise metadata, content tags, adaptive engine parameters, health markers)
3. THE Platform SHALL version content records (articles, coaching plans) so that historical versions are preserved
4. THE Platform SHALL define database indexes on frequently queried columns (user_id, date ranges, status fields, category)
5. WHEN a new content category, food item, or health marker is added, THE Platform SHALL accommodate it without requiring a database schema migration
6. THE Platform SHALL support feature flags via the Feature_Flag_Service to enable or disable functionality at runtime without redeployment

### Requirement 16: Security and Audit

**User Story:** As a platform operator, I want robust security controls and audit logging, so that user data is protected and system activity is traceable.

#### Acceptance Criteria

1. THE Auth_Service SHALL issue JWT access tokens with a short expiration (configurable, default 15 minutes)
2. THE Auth_Service SHALL issue refresh tokens with a longer expiration (configurable, default 7 days)
3. THE Platform SHALL validate and sanitize all user inputs to prevent injection attacks
4. THE Platform SHALL log all state-changing operations (create, update, delete) to an audit log with timestamp, user_id, action, and affected entity
5. WHEN a webhook is received, THE Payment_Gateway SHALL verify the cryptographic signature before processing
6. THE API_Gateway SHALL enforce rate limiting per user and per IP address

### Requirement 17: Analytics Integration

**User Story:** As a platform operator, I want to track user engagement and conversion metrics, so that I can make data-driven product decisions.

#### Acceptance Criteria

1. THE Analytics_Service SHALL track daily active users (DAU) by recording unique user sessions per day
2. THE Analytics_Service SHALL track conversion events when a Free_User upgrades to a Premium_User subscription
3. THE Analytics_Service SHALL track coaching request submissions as discrete events
4. THE Analytics_Service SHALL track article read events with article_id and user_id
5. THE Analytics_Service SHALL track feature usage events for key platform interactions
6. THE Analytics_Service SHALL integrate with PostHog as the analytics backend

### Requirement 18: Frontend Navigation and UI Structure

**User Story:** As a user, I want a clear and visually consistent interface with intuitive navigation, so that I can efficiently access all platform features.

#### Acceptance Criteria

1. THE Platform SHALL provide a bottom navigation bar with tabs for Dashboard, Logs, Analytics, Learn, and Profile
2. THE Platform SHALL display a premium badge indicator for Premium_Users
3. WHEN a Free_User views the interface, THE Platform SHALL display a subscription upgrade banner
4. WHEN a Free_User taps the upgrade banner, THE Platform SHALL present an in-app upgrade modal with subscription options
5. THE Platform SHALL apply the design token system consistently across all screens: base background #0B0F14, surface layers #111827 and #161C24 with subtle 1px inner borders (rgba(255,255,255,0.04)), accent #2563EB, positive #22C55E, alert #EF4444, warning #F59E0B, primary text #E5E7EB (max 92% brightness, never pure white), secondary text #9CA3AF, muted text #6B7280
6. THE Platform SHALL use an 8px grid spacing system with 12-16px border radius on interactive elements and restrained motion (200ms cubic-bezier(0.4,0,0.2,1))
7. THE Platform SHALL use Inter or SF Pro typography with semibold (600) for headings, regular (400) for body, and tabular lining numerals for data-heavy sections
8. THE Platform SHALL use a premium gold accent (#D4AF37) only for lock icons and small badges, and gradients only for premium CTA buttons (#2563EB to #1E3A8A)

### Requirement 19: Learn Section UI

**User Story:** As a user, I want a rich and engaging Learn section, so that I can discover, read, and save educational content easily.

#### Acceptance Criteria

1. WHEN a user opens the Learn section, THE Platform SHALL display an articles list view with category filter controls
2. WHEN a user selects an article, THE Platform SHALL navigate to an article detail page showing full Markdown content, embedded videos, and estimated read time
3. WHEN a user scrolls through an article, THE Platform SHALL display a scroll progress indicator
4. WHEN a user saves an article to favorites, THE Platform SHALL persist the favorite and provide visual confirmation
5. WHEN an article is premium-only and the user is a Free_User, THE Platform SHALL display a premium lock indicator on the article card

### Requirement 20: Serialization and API Data Contracts

**User Story:** As a developer, I want well-defined API data contracts with reliable serialization, so that clients and servers communicate without data loss or ambiguity.

#### Acceptance Criteria

1. THE API_Gateway SHALL serialize all response bodies as JSON
2. THE API_Gateway SHALL deserialize all request bodies from JSON and validate against the expected schema
3. FOR ALL valid API response objects, serializing to JSON then deserializing SHALL produce an equivalent object (round-trip property)
4. IF a request body fails schema validation, THEN THE API_Gateway SHALL return a 400 error with details of the validation failures

### Requirement 21: Admin Content and Data Management

**User Story:** As an admin, I want to manage educational content, food database entries, and founder story content, so that I can keep the platform's content fresh and accurate.

#### Acceptance Criteria

1. WHEN an Admin creates or updates a content article, THE Content_System SHALL persist the changes and create a version history entry
2. WHEN an Admin adds or updates a food item in the Food_Database, THE Food_Database SHALL persist the changes without requiring a schema migration
3. WHEN an Admin updates the founder story content, THE Founder_Story_Module SHALL persist the changes and make them immediately available to users
4. WHEN an Admin manages marker reference ranges for health reports, THE Health_Report_Service SHALL update the reference data without requiring a schema migration
5. THE Platform SHALL restrict all admin management endpoints to users with the Admin role

### Requirement 22: User Account Deletion

**User Story:** As a user, I want to delete my account and all associated data, so that I can exercise my right to data removal.

#### Acceptance Criteria

1. WHEN a user requests account deletion, THE Platform SHALL initiate a 30-day grace period during which the account is deactivated but data is retained
2. WHEN the 30-day grace period expires without the user reactivating, THE Platform SHALL permanently delete all user data including profile, metrics, nutrition entries, training sessions, health reports, and subscription records
3. WHEN a user reactivates their account within the grace period, THE Platform SHALL restore full access to all previously existing data
4. THE Platform SHALL cancel any active subscription before initiating account deletion
5. THE Platform SHALL log the deletion request in the audit log
