# Requirements Document

## Introduction

This document specifies the requirements for a comprehensive UX redesign of the HypertrophyOS mobile/web fitness application. The redesign addresses severe usability problems identified from a product design audit: cluttered 6-tab navigation, absent visual progress indicators, inconsistent component styling, broken layouts (vertical filter pills), poor empty states, and modals that look broken on web. The goal is to elevate the app to a premium fitness product standard — think Whoop's data density, Oura's calm visual hierarchy, and RP's functional depth — while preserving the dark theme and React Native/Expo stack. This is a frontend-only effort.

## Glossary

- **App**: The HypertrophyOS React Native/Expo fitness application running on mobile and web
- **Dashboard**: The primary home screen showing daily progress, quick actions, and activity summary
- **Bottom_Tab_Navigator**: The bottom navigation bar providing access to top-level screens
- **Progress_Ring**: A circular SVG-based visual indicator showing percentage completion of a daily macro target with animated fill, center label, and color transitions
- **Quick_Action_Button**: A prominent touchable element on the Dashboard for logging nutrition, training, or bodyweight
- **Empty_State**: A placeholder UI shown when a screen or section has no data, consisting of an icon/illustration, explanatory text, and a call-to-action button
- **Design_Token_System**: The centralized theme configuration in `app/theme/tokens.ts` defining colors, spacing, typography, radius, and motion values
- **Card_Component**: The reusable `Card` component providing content containers with variant support
- **Button_Component**: The reusable `Button` component providing action triggers with variant support
- **Filter_Pill**: A horizontal, pill-shaped touchable element used for category filtering
- **Modal_Sheet**: A bottom-sheet overlay used for data entry on mobile; a centered dialog on web
- **Surface_Level**: A distinct background color tier creating visual depth (base → surface → surfaceRaised)
- **Spacing_Scale**: The consistent spacing values (4/8/12/16/24/32px) used for all padding and margins
- **Color_Ramp**: A set of semantically-named colors for macro tracking: calories (cyan), protein (emerald), carbs (amber), fat (rose)
- **Micro_Interaction**: A subtle animation or visual feedback triggered by user actions (tap, scroll, state change)
- **Streak_Indicator**: A visual element showing consecutive days of logging activity

## Requirements

### Requirement 1: Navigation Consolidation

**User Story:** As a user, I want a clean 4-tab navigation that puts the most important actions within one tap, so that I spend less time navigating and more time logging.

#### Acceptance Criteria

1. THE Bottom_Tab_Navigator SHALL display exactly 4 tabs: Home, Log, Analytics, and Profile
2. WHEN the user taps the active tab icon, THE App SHALL scroll the current screen to the top (standard iOS/Android convention)
3. WHEN the App renders the Bottom_Tab_Navigator, THE App SHALL display tab icons at 24px with a 2px active indicator dot below the active tab icon, using accent color for active and muted color for inactive
4. THE Bottom_Tab_Navigator SHALL use a subtle top border (1px, rgba white at 6% opacity) and a background that matches bg.surface to create a floating-bar effect
5. WHEN the user navigates to the Profile tab, THE App SHALL provide access to Coaching, Community, Founder's Story, Health Reports, and Learn content as navigable sections within the Profile screen
6. THE App SHALL NOT render separate "More" or "Learn" tabs in the Bottom_Tab_Navigator

### Requirement 2: Dashboard — Daily Progress Rings

**User Story:** As a user, I want to see my daily calorie, protein, and carb progress as animated rings the moment I open the app, so that I instantly know where I stand without reading numbers.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE App SHALL display the user's display name in the greeting (e.g., "Good morning, Alex") or fall back to a time-based greeting if no name is set
2. WHEN the Dashboard displays daily macro progress, THE App SHALL render three Progress_Ring components in a horizontal row for calories, protein, and carbs, each using a distinct color from the Color_Ramp (calories: cyan #06B6D4, protein: emerald #22C55E, carbs: amber #F59E0B)
3. WHEN a Progress_Ring renders, THE App SHALL display the current value centered inside the ring in bold typography, with the target value and unit displayed below in muted text
4. WHEN a Progress_Ring fill percentage is between 0% and 100%, THE App SHALL render the ring stroke proportionally filled with the assigned Color_Ramp color against a muted track (10% opacity of the same color)
5. WHEN a Progress_Ring value exceeds 100% of the target, THE App SHALL change the ring color to the semantic warning color (#F59E0B) and display an "over" indicator
6. IF the target value for a Progress_Ring is zero or unavailable, THEN THE App SHALL display the ring with a fully muted track and the text "Set targets" as a tappable link to profile settings
7. THE Dashboard SHALL NOT display a separate "Adaptive Targets" section — target values SHALL be integrated into the Progress_Ring labels

### Requirement 3: Dashboard — Activity Summary and Quick Actions

**User Story:** As a user, I want to see what I've done today and have prominent buttons to log more, so that the dashboard feels alive and action-oriented.

#### Acceptance Criteria

1. THE Dashboard SHALL display a "Today" summary row showing the count of meals logged and workouts completed for the current day, using semantic positive color for completed items and muted color for zero counts
2. WHEN the Dashboard displays Quick_Action_Buttons, THE App SHALL render them as a horizontal row of three equally-sized cards with a 48px icon area, a label below, and a subtle left-border accent in the Color_Ramp color corresponding to the action type (cyan for nutrition, emerald for training, amber for bodyweight)
3. WHEN a user taps a Quick_Action_Button, THE App SHALL open the corresponding data entry modal with a scale-up entrance animation (150ms, ease-out)
4. WHEN the user has logged at least one entry for a category today, THE Quick_Action_Button for that category SHALL display a small checkmark badge in the semantic positive color
5. THE Dashboard SHALL display a Streak_Indicator showing the number of consecutive days the user has logged at least one nutrition or training entry, using a flame icon and the streak count in accent color

### Requirement 4: Dashboard — Featured Content

**User Story:** As a user, I want to discover educational content from the dashboard, so that I stay engaged and learn without navigating to a separate tab.

#### Acceptance Criteria

1. WHEN the Dashboard has available Learn content, THE App SHALL display a "Featured" section with a horizontally-scrollable row of article cards
2. WHEN a featured article card renders, THE App SHALL display a colored category indicator strip at the top, the article title (max 2 lines), estimated read time, and a subtle arrow icon
3. WHEN the user taps a featured article card, THE App SHALL navigate to the article detail screen
4. WHEN no Learn content is available, THE Dashboard SHALL omit the Featured section entirely rather than showing an empty state

### Requirement 5: Color System and Visual Hierarchy

**User Story:** As a user, I want the app to have clear visual depth where cards pop off the background and important elements draw my eye, so that the interface feels premium and easy to scan.

#### Acceptance Criteria

1. THE Design_Token_System SHALL define surface background colors with clear luminance steps: bg.base (#0A0E13), bg.surface (#12171F), bg.surfaceRaised (#1A2029), creating a minimum 4% luminance increase per level
2. THE Design_Token_System SHALL define a Color_Ramp for macro tracking: calories (#06B6D4 cyan), protein (#22C55E emerald), carbs (#F59E0B amber), fat (#F472B6 rose), each with a subtle variant at 12% opacity for backgrounds
3. THE Design_Token_System SHALL define card borders using rgba white at 8% opacity for default state and 12% opacity for hover/focus state, providing visible but non-distracting edges
4. THE Design_Token_System SHALL reserve the accent color (#06B6D4) exclusively for primary action buttons, active navigation states, and interactive focus rings — not for decorative or informational elements
5. WHEN a progress bar or progress ring renders, THE App SHALL use the corresponding Color_Ramp color at full opacity for the filled portion and at 10% opacity for the unfilled track
6. THE Design_Token_System SHALL define text colors with clear hierarchy: primary (#F1F5F9 — near-white for headings and values), secondary (#94A3B8 — for labels and body), muted (#64748B — for hints and disabled)

### Requirement 6: Component Library — Buttons

**User Story:** As a developer, I want a standardized button system with clear visual hierarchy, so that users always know which action is primary and which is secondary.

#### Acceptance Criteria

1. THE Button_Component SHALL support four variants: primary (solid accent background, white text), secondary (transparent background, 1px border in border.default, accent-colored text), ghost (transparent background, no border, accent-colored text), and danger (negative-subtle background, 1px negative border, negative-colored text)
2. THE Button_Component SHALL enforce a minimum touch target of 44px height across all variants
3. WHEN a primary Button_Component renders, THE App SHALL apply a subtle box-shadow (0 2px 8px rgba(6,182,212,0.25)) to give it visual lift above the surface
4. WHEN a Button_Component is in the disabled state, THE App SHALL reduce its opacity to 0.4 and prevent touch interaction
5. WHEN a Button_Component is pressed, THE App SHALL scale it to 0.97 for 100ms (press feedback) before executing the onPress handler

### Requirement 7: Component Library — Cards and Inputs

**User Story:** As a developer, I want standardized card and input components, so that every content container and form field looks consistent across the app.

#### Acceptance Criteria

1. THE Card_Component SHALL support three variants: flat (bg.surface, 1px border at border.subtle, no shadow), raised (bg.surfaceRaised, 1px border at border.default, md shadow), and outlined (transparent background, 1px border at border.default, no shadow)
2. THE Card_Component SHALL apply consistent internal padding of 16px and border-radius of 12px across all variants
3. WHEN a text input field renders, THE App SHALL apply: bg.surfaceRaised background, 1px border in border.default, 12px padding, 14px font-size, primary text color, and muted placeholder color
4. WHEN a text input field receives focus, THE App SHALL change its border color to the accent color (#06B6D4) with a 150ms transition
5. WHEN a section header renders, THE App SHALL apply: 18px font-size, semibold weight, primary text color, 24px top margin, and 12px bottom margin

### Requirement 8: Empty States

**User Story:** As a user, I want helpful guidance when screens are empty, so that I understand what the screen does and feel motivated to take action.

#### Acceptance Criteria

1. WHEN a screen or section has no data to display, THE App SHALL render an Empty_State component containing: a 48px muted-color icon, a title in secondary text color, a description in muted text color, and a primary-variant call-to-action Button_Component
2. WHEN the Logs screen has no entries for the selected tab, THE App SHALL display an Empty_State with the title "No [nutrition/training] entries yet", a description "Tap the button below to log your first entry", and a CTA button that opens the corresponding add modal
3. WHEN the Analytics screen has no data for a chart section, THE App SHALL display a compact inline Empty_State within the chart card area with a muted icon and the text describing what data is needed (e.g., "Log bodyweight to see trends")
4. WHEN the Learn screen has no articles for the selected category, THE App SHALL display an Empty_State with the title "No articles yet", a description suggesting the user try a different category, and pill buttons for other available categories

### Requirement 9: Learn Screen Layout Fix

**User Story:** As a user, I want to browse educational content with properly-rendered horizontal filter pills and rich article cards, so that the Learn experience feels polished and engaging.

#### Acceptance Criteria

1. WHEN the Learn screen renders category filters, THE App SHALL display them as a single horizontally-scrolling row of Filter_Pill elements with 8px gaps, 12px vertical padding, and full-radius corners
2. WHEN a Filter_Pill is active, THE App SHALL render it with accent-primaryMuted background and accent-colored border and text
3. WHEN a Filter_Pill is inactive, THE App SHALL render it with bg.surface background, border.subtle border, and muted text color
4. WHEN the Learn screen displays article cards, THE App SHALL show: a category color strip (4px left border in the category color), title (16px, semibold), estimated read time in muted text, tag pills, and a favorite star toggle
5. WHEN the user taps the favorite star on an article card, THE App SHALL toggle the star between muted (unfavorited) and warning/gold color (favorited) with a scale bounce animation (1.2x for 150ms)

### Requirement 10: Modal and Data Entry — Platform Adaptation

**User Story:** As a user, I want data entry forms that feel native on both mobile and web, so that logging is fast and comfortable regardless of platform.

#### Acceptance Criteria

1. WHEN the App runs on web (Platform.OS === 'web') and a data entry modal opens, THE App SHALL render it as a centered dialog (max-width 480px, vertically centered) with a backdrop blur (8px) and 60% opacity dark overlay
2. WHEN the App runs on mobile and a data entry modal opens, THE App SHALL render it as a bottom sheet with rounded top corners (16px radius), a drag handle indicator at the top, and a 60% opacity dark overlay
3. WHEN the nutrition modal opens, THE App SHALL display the favorites section at the top of the scrollable content, before the food search section, with each favorite rendered as a tappable chip showing the meal name and calorie count
4. WHEN the training modal opens, THE App SHALL display the templates section expanded by default with template cards visible, not collapsed behind a toggle
5. WHEN the training modal displays set entry fields, THE App SHALL render each input with a minimum width of 56px, 12px padding, and centered text for comfortable numeric entry

### Requirement 11: Progress Bars and Percentage Indicators

**User Story:** As a user, I want to see progress bars with percentage labels on nutrition and analytics screens, so that I can quickly understand my progress numerically and visually.

#### Acceptance Criteria

1. WHEN a linear progress bar renders for a macro value, THE App SHALL display a filled bar using the corresponding Color_Ramp color, an unfilled track at 10% opacity of the same color, and a percentage label (e.g., "72%") right-aligned in secondary text color
2. WHEN a linear progress bar fill exceeds 100%, THE App SHALL cap the visual fill at 100% and change the bar color to the semantic warning color
3. WHEN the Analytics screen displays trend charts, THE App SHALL render a target reference line (dashed, 1px, muted color) at the target value when a target is available
4. WHEN the Analytics screen displays a comparison between actual and target values, THE App SHALL show the percentage of target achieved with color coding: semantic positive for 90-110%, semantic warning for 70-89% or 111-130%, and semantic negative for below 70% or above 130%

### Requirement 12: Profile Screen Consolidation

**User Story:** As a user, I want all settings, secondary features, and account management in one Profile screen, so that I have a single organized place for everything about my account.

#### Acceptance Criteria

1. WHEN the Profile screen renders, THE App SHALL include a "Features" section with navigation items for Coaching, Community, Founder's Story, Health Reports, and Learn, each displayed with a 24px icon, a label, a one-line description in muted text, and a chevron arrow
2. WHEN the user taps a feature navigation item on the Profile screen, THE App SHALL navigate to the corresponding screen using a stack push animation
3. THE Profile screen SHALL organize content into clearly-labeled sections: user info card at top, then "Features", then "Preferences" (units, rest timer), then "Subscription", then "Account" (logout, delete) at the bottom
4. WHEN the Profile screen renders the user info card, THE App SHALL display the avatar initial in a 64px circle with accent-primaryMuted background, the display name, email, and premium badge (if applicable)

### Requirement 13: Spacing and Layout Consistency

**User Story:** As a developer, I want a strict spacing system enforced across all screens, so that the app feels cohesive and every pixel is intentional.

#### Acceptance Criteria

1. THE App SHALL use only values from the Spacing_Scale (4, 8, 12, 16, 24, 32 pixels) for all padding and margin values across all screens and components
2. WHEN a screen renders its scrollable content, THE App SHALL apply 16px horizontal padding to the content container
3. WHEN sections are stacked vertically on a screen, THE App SHALL apply 24px vertical spacing between section headers and 12px between a section header and its content
4. WHEN cards are arranged in a horizontal row, THE App SHALL apply 12px gap spacing between them
5. WHEN the App renders a list of vertically-stacked cards, THE App SHALL apply 12px vertical spacing between each card

### Requirement 14: Screen Transitions and Navigation Animations

**User Story:** As a user, I want smooth, fluid transitions when navigating between screens, so that the app feels fast, polished, and premium rather than just functional.

#### Acceptance Criteria

1. WHEN the user switches between bottom tabs, THE App SHALL apply a crossfade transition (200ms, ease-out) between the outgoing and incoming screens instead of an instant swap
2. WHEN the user navigates to a detail screen via stack push, THE App SHALL apply a slide-from-right transition (250ms, ease-out) with the incoming screen sliding in from 30% offset while the outgoing screen fades to 95% opacity
3. WHEN the user navigates back from a detail screen, THE App SHALL apply a slide-to-right transition (200ms, ease-in-out) that mirrors the push animation
4. WHEN a modal opens, THE App SHALL apply a scale-up entrance animation (from 0.95 to 1.0 scale, 200ms, ease-out) combined with a fade-in of the backdrop overlay
5. WHEN a modal closes, THE App SHALL apply a scale-down exit animation (from 1.0 to 0.95 scale, 150ms, ease-in) combined with a fade-out of the backdrop overlay

### Requirement 15: Content Loading and Stagger Animations

**User Story:** As a user, I want content to appear with elegant staggered animations when screens load, so that the app feels dynamic and alive rather than static.

#### Acceptance Criteria

1. WHEN the Dashboard loads its sections (greeting, progress rings, today summary, quick actions, featured content), THE App SHALL animate each section in with a staggered fade-up effect: each section fades from 0 to 1 opacity and translates from 12px below to 0px, with a 60ms stagger delay between sections
2. WHEN a list of cards loads on any screen (Logs, Learn, Analytics), THE App SHALL animate each card in with a staggered fade-up effect with a 40ms stagger delay between cards, up to a maximum of 8 animated cards (remaining cards appear instantly)
3. WHEN a Progress_Ring animates its fill on Dashboard load, THE App SHALL animate the stroke from 0% to the target percentage over 600ms using an ease-out curve, starting after the ring's container has faded in
4. WHEN data refreshes via pull-to-refresh, THE App SHALL NOT replay stagger animations — updated content SHALL appear instantly to avoid visual noise on repeated loads

### Requirement 16: Interactive Feedback and Micro-Animations

**User Story:** As a user, I want tactile visual feedback on every interaction, so that the app feels responsive and every tap registers clearly.

#### Acceptance Criteria

1. WHEN the user presses any touchable card or list item, THE App SHALL scale it to 0.98 for the duration of the press (activeOpacity combined with transform scale) and return to 1.0 on release with a 100ms ease-out transition
2. WHEN the user toggles a favorite star, THE App SHALL animate the star with a scale bounce (1.0 → 1.3 → 1.0 over 200ms) and a color transition from muted to warning/gold
3. WHEN a numeric value changes on the Dashboard (calories, protein, streak count), THE App SHALL animate the number transition using a counting-up effect over 400ms rather than an instant swap
4. WHEN the user completes a data entry form and taps Save, THE App SHALL display a brief success state: a checkmark icon scales up from 0 to 1 (200ms, spring ease) before the modal closes
5. WHEN a Filter_Pill is tapped to change category, THE App SHALL animate the active state transition with a background color fade (150ms) rather than an instant color swap

### Requirement 17: Skeleton Loading States

**User Story:** As a user, I want to see placeholder skeletons while data loads, so that the app feels fast and I know content is coming rather than staring at a blank screen.

#### Acceptance Criteria

1. WHEN the Dashboard is loading data, THE App SHALL display skeleton placeholders for the Progress_Ring components (pulsing circular outlines), the Today summary row (pulsing rectangular bars), and the Quick_Action_Buttons (pulsing card shapes)
2. WHEN the Logs screen is loading entries, THE App SHALL display 3 skeleton card placeholders with pulsing animation (opacity oscillating between 0.3 and 0.7 over 1.2s, ease-in-out, infinite loop)
3. WHEN the Analytics screen is loading chart data, THE App SHALL display a skeleton placeholder within each chart card area matching the chart dimensions
4. WHEN skeleton placeholders are visible, THE App SHALL use bg.surfaceRaised color for the skeleton shapes against the bg.surface card background to maintain the surface hierarchy
