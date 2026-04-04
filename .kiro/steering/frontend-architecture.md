---
inclusion: manual
---

# Frontend Architecture

## Entry Point
`app/App.tsx` — Auth state check, onboarding flow, navigation container.

## Navigation (4 tabs)
```
BottomTabNavigator
├── Home (DashboardStack) → Dashboard, ExercisePicker, ActiveWorkout, WeeklyReport, ArticleDetail, Learn
├── Log (LogsStack) → Logs, ExercisePicker, ActiveWorkout, SessionDetail
├── Analytics (AnalyticsStack) → Analytics (training/nutrition tabs), NutritionReport, MicronutrientDashboard, WeeklyReport
└── Profile (ProfileStack) → Profile, FeedScreen, LeaderboardScreen, Learn, Coaching, FounderStory, HealthReports, ProgressPhotos, MealPlan, UpgradeModal
```

## State Management: Zustand + TanStack Query v5
- **Zustand** for UI/client state only (auth, active workout, onboarding, preferences, tooltips).
- **TanStack Query v5** for ALL server state. NOT raw useEffect+axios.
- Query key factories in each domain (e.g., `useDashboardQueries.ts` uses `useQueries`).

| Zustand Store | Purpose |
|---------------|---------|
| `store/index.ts` | Auth, profile, subscription, coaching, goals |
| `store/activeWorkoutSlice.ts` | Active workout state, set tracking |
| `store/onboardingSlice.ts` | Onboarding wizard state |
| `store/workoutPreferencesStore.ts` | Unit system, rest timer prefs |

## Offline Support: TanStack Query + MMKV
- Mutations use `useMutation` with `mutationKey` to survive app restarts.
- MMKV persister for query cache persistence.
- Offline food cache for food search without network.
- Network manager via `@react-native-community/netinfo` — detects connectivity changes.
- Key pattern: **Use `useMutation` with `mutationKey` for ANY write that should survive offline.**

## Payments: RevenueCat Only
- `app/services/purchases.ts` — RevenueCat SDK integration.
- `UpgradeModal` is RevenueCat-only. No Stripe/Razorpay anywhere in frontend.
- Entitlement checks via RevenueCat SDK, synced to Zustand subscription state.

## Social Module
- `FeedScreen` + `LeaderboardScreen` in Profile stack.
- Components: `FeedCard`, `ReactionButton`, `LeaderboardRow`.
- Data fetched via TanStack Query (infinite scroll for feed).

## Apple Watch
- `app/hooks/useWatch.ts` — bridge hook for Watch communication.
- Dynamic import of `react-native-watch-connectivity` (not bundled if unavailable).
- Sends active workout data to Watch; receives heart rate back.

## Feature Gating: PostHog
- `app/hooks/useGatedFeature.ts` — checks PostHog feature flags.
- `app/components/premium/FeatureGate.tsx` — conditional render wrapper.
- All features free at launch (gates ready for future monetization).

## ActiveWorkoutScreen (Decomposed)
- Screen is a thin UI shell. ALL logic lives in hooks:
  - `useWorkoutSave` — handles save/finish/discard mutations.
  - `useWorkoutData` — manages sets, exercises, workout state.
- **Do NOT add business logic to ActiveWorkoutScreen directly.**

## Dashboard
- `app/hooks/queries/useDashboardQueries.ts` — parallel fetching via `useQueries`.
- Query key factories for cache invalidation.
- Dashboard data: volume summary, daily targets, streak, weekly report preview.

## Onboarding
- 9 steps (Food DNA step is skipped/deferred). State in `onboardingSlice.ts`.
- `app/components/OnboardingProgress.tsx` — progress indicator component.

## Custom Hooks (`app/hooks/`)

| Hook | Purpose |
|------|---------|
| `useGatedFeature.ts` | PostHog feature flag check |
| `useWatch.ts` | Apple Watch bridge |
| `useWNSVolume.ts` | WNS weekly volume (TanStack Query) |
| `useMicroDashboard.ts` | Micronutrient dashboard data |
| `useDailyTargets.ts` | Adaptive daily macro targets |
| `useDashboardQueries.ts` | Parallel dashboard queries (in `hooks/queries/`) |
| `useHaptics.ts` | Haptic feedback (light/medium/heavy) |
| `useReduceMotion.ts` | Respect system reduce-motion |

## Key Utilities (`app/utils/`)
- **WNS**: `wnsCalculator.ts` — client-side HU estimation (mirrors Python engine)
- **Volume**: `volumeAggregator.ts`, `muscleVolumeLogic.ts` — tracking, heat map colors
- **Nutrition**: `microNutrientSerializer.ts`, `rdaValues.ts` — RDA handling
- **Training**: `restTimerLogic.ts`, `plateCalculator.ts` — training UX
- **Food**: `servingOptions.ts`, `foodSearch*.ts` — food logging

## Component Library (`app/components/`)
- `common/` — Card, Button, Icon, ModalContainer, ErrorBoundary, EmptyState
- `training/` — VolumeIndicatorPill, FinishConfirmationSheet, PlateCalculatorSheet
- `analytics/` — HeatMapCard, BodyHeatMap, DrillDownModal, WeekNavigator
- `nutrition/` — WaterTracker, BarcodeScanner
- `social/` — FeedCard, ReactionButton, LeaderboardRow
- `modals/` — AddNutritionModal, QuickAddModal, AddTrainingModal, UpgradeModal

## API Client
`app/services/api.ts` — Axios instance (base URL, JWT header, auto token refresh on 401). Used by TanStack Query's `queryFn` — never called directly from components.

## Theme System
`app/theme/tokens.ts` — colors (semantic + heatmap), typography, spacing (4px base), radius, motion tokens.

## Key Patterns
```typescript
// Server state: TanStack Query (PREFERRED)
const { data, isLoading } = useQuery({ queryKey: ['volume', weekStart], queryFn: () => api.get(...) });

// Offline-safe mutation
const { mutate } = useMutation({ mutationKey: ['saveWorkout'], mutationFn: saveWorkout, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }) });
```
