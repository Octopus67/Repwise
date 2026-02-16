import { create } from 'zustand';

// ─── Auth slice types ────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  role: 'user' | 'premium' | 'admin';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ─── User profile types ──────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  timezone: string | null;
  preferredCurrency: string | null;
  region: string | null;
  coachingMode?: string;
  preferences?: {
    unit_system?: 'metric' | 'imperial';
    rest_timer?: {
      compound_seconds?: number;
      isolation_seconds?: number;
    };
    [key: string]: unknown;
  } | null;
}

// ─── Subscription types ──────────────────────────────────────────────────────

export type SubscriptionStatus =
  | 'free'
  | 'pending_payment'
  | 'active'
  | 'past_due'
  | 'cancelled';

export interface Subscription {
  id: string;
  status: SubscriptionStatus;
  planId: string | null;
  currency: string | null;
  currentPeriodEnd: string | null;
}

// ─── Store shape ─────────────────────────────────────────────────────────────

interface AppState {
  // Auth
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;

  // Profile
  profile: UserProfile | null;

  // Subscription
  subscription: Subscription | null;

  // Onboarding
  needsOnboarding: boolean | null;
  onboardingSkipped: boolean;

  // Unit system
  unitSystem: 'metric' | 'imperial';

  // RPE/RIR mode preference
  rpeMode: 'rpe' | 'rir';

  // Date navigation
  selectedDate: string;

  // Adaptive targets (cached from last API fetch)
  adaptiveTargets: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  } | null;

  // Coaching state
  coachingMode: 'coached' | 'collaborative' | 'manual';
  weeklyCheckin: {
    has_sufficient_data: boolean;
    days_remaining?: number | null;
    new_targets?: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null;
    previous_targets?: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null;
    weight_trend?: number | null;
    weekly_weight_change?: number | null;
    explanation: string;
    suggestion_id?: string | null;
    coaching_mode: string;
  } | null;

  // Goals & metrics (profile redesign)
  goals: {
    id: string;
    userId: string;
    goalType: string;
    targetWeightKg: number | null;
    goalRatePerWeek: number | null;
  } | null;
  latestMetrics: {
    id: string;
    heightCm: number | null;
    weightKg: number | null;
    bodyFatPct: number | null;
    activityLevel: string | null;
    recordedAt: string;
  } | null;

  // Achievement celebrations
  pendingCelebrations: {
    achievement_id: string;
    title: string;
    description: string;
    icon: string;
    category: string;
  }[];
}

interface AppActions {
  // Auth
  setAuth: (user: User, tokens: AuthTokens) => void;
  clearAuth: () => void;
  updateTokens: (tokens: AuthTokens) => void;

  // Profile
  setProfile: (profile: UserProfile) => void;

  // Subscription
  setSubscription: (subscription: Subscription) => void;

  // Onboarding
  setNeedsOnboarding: (needs: boolean) => void;
  setOnboardingSkipped: (skipped: boolean) => void;

  // Unit system
  setUnitSystem: (system: 'metric' | 'imperial') => void;

  // RPE/RIR mode
  setRpeMode: (mode: 'rpe' | 'rir') => void;

  // Date navigation
  setSelectedDate: (date: string) => void;

  // Adaptive targets
  setAdaptiveTargets: (targets: AppState['adaptiveTargets']) => void;

  // Coaching
  setCoachingMode: (mode: 'coached' | 'collaborative' | 'manual') => void;
  setWeeklyCheckin: (checkin: AppState['weeklyCheckin']) => void;

  // Goals & metrics (profile redesign)
  setGoals: (goals: AppState['goals']) => void;
  setLatestMetrics: (metrics: AppState['latestMetrics']) => void;

  // Achievement celebrations
  setPendingCelebrations: (celebrations: AppState['pendingCelebrations']) => void;
  clearCelebrations: () => void;
}

export type AppStore = AppState & AppActions;

// ─── Derived helpers ─────────────────────────────────────────────────────────

export const isPremium = (store: AppStore): boolean =>
  store.subscription?.status === 'active' || store.subscription?.status === 'past_due';

// ─── Store ───────────────────────────────────────────────────────────────────

export const useStore = create<AppStore>((set) => ({
  // Auth state
  user: null,
  tokens: null,
  isAuthenticated: false,

  // Profile state
  profile: null,

  // Subscription state
  subscription: null,

  // Onboarding state
  needsOnboarding: null,
  onboardingSkipped: false,

  // Unit system state
  unitSystem: 'metric',

  // RPE/RIR mode state
  rpeMode: 'rpe',

  // Date navigation state
  selectedDate: new Date().toISOString().split('T')[0],

  // Adaptive targets state
  adaptiveTargets: null,

  // Coaching state
  coachingMode: 'coached',
  weeklyCheckin: null,

  // Goals & metrics state
  goals: null,
  latestMetrics: null,

  // Achievement celebrations state
  pendingCelebrations: [],

  // Auth actions
  setAuth: (user, tokens) => set({ user, tokens, isAuthenticated: true }),
  clearAuth: () =>
    set({
      user: null,
      tokens: null,
      isAuthenticated: false,
      profile: null,
      subscription: null,
      needsOnboarding: null,
      onboardingSkipped: false,
      unitSystem: 'metric',
      rpeMode: 'rpe',
      coachingMode: 'coached',
      weeklyCheckin: null,
      goals: null,
      latestMetrics: null,
      pendingCelebrations: [],
    }),
  updateTokens: (tokens) => set({ tokens }),

  // Profile actions
  setProfile: (profile) => {
    const unitSystem = profile.preferences?.unit_system === 'imperial' ? 'imperial' : 'metric';
    const coachingMode = (profile.coachingMode as any) || 'coached';
    set({ profile, unitSystem, coachingMode });
  },

  // Subscription actions
  setSubscription: (subscription) => set({ subscription }),

  // Onboarding actions
  setNeedsOnboarding: (needs) => set({ needsOnboarding: needs }),
  setOnboardingSkipped: (skipped) => set({ onboardingSkipped: skipped }),

  // Unit system actions
  setUnitSystem: (system) => set({ unitSystem: system }),

  // RPE/RIR mode actions
  setRpeMode: (mode) => set({ rpeMode: mode }),

  // Date navigation actions
  setSelectedDate: (date) => set({ selectedDate: date }),

  // Adaptive targets actions
  setAdaptiveTargets: (targets) => set({ adaptiveTargets: targets }),

  // Coaching actions
  setCoachingMode: (mode) => set({ coachingMode: mode }),
  setWeeklyCheckin: (checkin) => set({ weeklyCheckin: checkin }),

  // Goals & metrics actions
  setGoals: (goals) => set({ goals }),
  setLatestMetrics: (metrics) => set({ latestMetrics: metrics }),

  // Achievement celebrations actions
  setPendingCelebrations: (celebrations) => set({ pendingCelebrations: celebrations }),
  clearCelebrations: () => set({ pendingCelebrations: [] }),
}));
