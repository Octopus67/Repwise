# Repwise UI Audit Report

**Date:** April 5, 2026
**Scope:** Every screen, modal, component, and interaction pattern
**Screens audited:** 19 screens, 12 modals, 30+ shared components

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 BUG | 14 | Functional issues — crashes, broken features, data loss |
| 🟡 UX | 28 | Usability gaps — confusing flows, missing states, poor affordances |
| 🟢 POLISH | 18 | Premium feel — animations, consistency, visual refinements |
| **Total** | **60** | |

---

## 🔴 BUGS (14) — Must Fix

| # | Screen/Component | Issue |
|---|-----------------|-------|
| B1 | RegisterScreen | **Missing `useMemo` import** — `useMemo` used but not imported. Will crash at runtime. |
| B2 | LogsScreen | **Swipe-to-delete has no confirmation** — entries deleted immediately on swipe, no alert, no undo. |
| B3 | LogsScreen | **Date navigation allows future dates** — right arrow has no guard, users can navigate to tomorrow+. |
| B4 | AnalyticsScreen | **No pull-to-refresh** — ScrollView has no RefreshControl. Users can't refresh stale data. |
| B5 | DashboardScreen | **QuickActionButton a11y props silently dropped** — `accessibilityLabel`/`accessibilityRole` passed but not destructured in component. |
| B6 | GoalStep (onboarding) | **Directional warning blocks navigation** — target weight warning prevents proceeding instead of just warning. |
| B7 | ModalContainer | **No safe area insets** — content overlaps home indicator on modern iPhones. Affects 4+ modals. |
| B8 | QuickAddModal | **Stub/placeholder** — contains only title and "Close" text. No functionality. |
| B9 | TrendLineChart | **Static width on rotation** — `CHART_WIDTH` calculated once at module load, never updates. |
| B10 | Skeleton | **Conditional hooks violation** — `useSharedValue`/`useEffect` called after early return, violating Rules of Hooks. |
| B11 | LoginScreen | **No explicit `disabled` on submit** — relies on Button's internal loading→disabled. Fast double-tap can double-submit. |
| B12 | LogsScreen | **Training card shows kg regardless of unit system** — hardcoded `weight_kg` display. |
| B13 | UpgradeModal | **No safe area insets** — raw Modal without insets. |
| B14 | ProfileScreen | **Logout has no confirmation dialog** — fires directly on button press. |

---

## 🟡 UX Issues (28) — Should Fix

### Auth & Onboarding (10)
| # | Screen | Issue |
|---|--------|-------|
| U1 | Login/Register/ForgotPassword | No auto-focus on first input field |
| U2 | ForgotPasswordScreen | Email input missing `returnKeyType`, `onSubmitEditing`, `accessibilityLabel` |
| U3 | OnboardingWizard | No keyboard dismiss on tap outside (affects GoalStep, TDEERevealStep inputs) |
| U4 | IntentStep | Goal cards missing `accessibilityLabel` and `accessibilityRole` |
| U5 | LifestyleStep | Activity cards, session buttons, exercise chips all missing a11y labels |
| U6 | DietStyleStep | Allows proceeding without selecting a diet style (no validation) |
| U7 | DietStyleStep | Protein stepper and diet cards missing a11y labels |
| U8 | TDEERevealStep | Override input accepts 0/negative with no error shown |
| U9 | SummaryStep | Hardcoded macro colors (`#4CAF50` etc.) instead of theme tokens — breaks dark mode |
| U10 | BodyMeasurementsStep | `Dimensions.get('window')` at module level — won't update on rotation |

### Core Screens (10)
| # | Screen | Issue |
|---|--------|-------|
| U11 | DashboardScreen | No welcome/onboarding card for brand-new users with zero data |
| U12 | LogsScreen (nutrition) | No empty state message — empty meal slots render but no first-use prompt |
| U13 | LogsScreen | No "Today" quick-return button (unlike Dashboard's DateScroller) |
| U14 | LogsScreen (web) | No delete affordance on web — SwipeableRow renders plain children |
| U15 | AnalyticsScreen | Exercise selector hardcoded — doesn't show user's actual exercise history |
| U16 | AnalyticsScreen | Single data point chart — no "Need more data" message |
| U17 | AnalyticsScreen | Tab pills missing `accessibilityLabel` |
| U18 | All modals | Use `Alert.alert()` for errors instead of inline ErrorBanner |
| U19 | AddBodyweightModal | No KeyboardAvoidingView — input hidden behind keyboard on small screens |
| U20 | ManualEntryForm | No max value constraint — user can type 999999 calories |

### Profile & Settings (8)
| # | Screen | Issue |
|---|--------|-------|
| U21 | ProfileScreen | Delete account has only single-step Alert — needs multi-step for irreversible action |
| U22 | ProfileScreen | No pinch-to-zoom on progress photos |
| U23 | ProfileScreen | PhotoComparison component exists but never rendered in ProgressPhotosScreen |
| U24 | SettingsScreen | Theme toggle missing "System" option (store supports it) |
| U25 | UpgradeModal/TrialExpiration | No X close button — must scroll to "Maybe later" |
| U26 | UpgradeModal/TrialExpiration | No backdrop tap to close |
| U27 | ImportDataScreen | Registered in navigation but no link from ProfileScreen — unreachable |
| U28 | Multiple screens | Pull-to-refresh inconsistent — Feed has it, Leaderboard/Profile/Measurements don't |

---

## 🟢 POLISH (18) — Premium Feel

### Animations & Transitions (6)
| # | Area | Issue | Recommendation |
|---|------|-------|----------------|
| P1 | Logs/Analytics tabs | No animated sliding indicator on tab switch | Add Reanimated sliding underline |
| P2 | Email verification | No success animation on verify | Add checkmark + confetti |
| P3 | Password reset | No success animation on reset | Add checkmark animation |
| P4 | Onboarding completion | No celebration animation after last step | Add confetti or success screen |
| P5 | ForgotPassword success | Abrupt swap to "Check Your Email" state | Add fade transition |
| P6 | Email verification digits | No animation when digit boxes fill | Add subtle scale pulse |

### Visual Consistency (7)
| # | Area | Issue | Recommendation |
|---|------|-------|----------------|
| P7 | NudgeCard | Hardcoded style values (12, 16, 4) instead of theme tokens | Use `radius.md`, `spacing[4]` |
| P8 | UpgradeModal/TrialExpiration/QuickAdd | Raw `<Modal animationType="slide">` instead of Reanimated | Use ModalContainer for consistency |
| P9 | PremiumBadge | Static — no entrance animation | Add subtle scale-in |
| P10 | Icon component | Duplicate SVGs (close/x, warning/alert-triangle) | Deduplicate |
| P11 | Icon component | Unknown icon names return null silently | Add fallback placeholder |
| P12 | PrepSundayFlow | Day selection uses filled square, no checkmark icon | Use checkmark icon |
| P13 | Photo delete | Only via long-press with no visual hint | Add trash icon overlay |

### Interaction Polish (5)
| # | Area | Issue | Recommendation |
|---|------|-------|----------------|
| P14 | DateScroller | Limited to 52 weeks back | Extend or add date picker |
| P15 | Macro ring overflow | Caps at 100% with no magnitude indication | Add numeric overflow label |
| P16 | Social reactions | No haptic or animation feedback on press | Add scale animation + haptic |
| P17 | Tab bar | No scroll-to-top on tab tap (iOS convention) | Add scroll-to-top behavior |
| P18 | BodyCompositionStep | No haptic feedback on card selection | Add `impact('light')` |

---

## Priority Fix Order

### Before Launch (Blockers)
1. **B1** — RegisterScreen missing useMemo import (crash)
2. **B10** — Skeleton conditional hooks violation (crash risk)
3. **B2** — Swipe-to-delete needs confirmation dialog
4. **B7** — ModalContainer safe area insets
5. **B14** — Logout confirmation dialog
6. **B11** — Login double-submit prevention

### First Week Post-Launch
7. **B3** — Future date guard on Logs
8. **B4** — Analytics pull-to-refresh
9. **B5** — QuickActionButton a11y props
10. **B6** — GoalStep warning vs blocker
11. **B12** — Unit system in training cards
12. **U18** — Inline errors in modals (replace Alert.alert)
13. **U11** — New user welcome state
14. **U25-U26** — Close buttons on upgrade/trial modals

### First Month (UX + Polish)
15. All remaining UX items (U1-U28)
16. All POLISH items (P1-P18)
