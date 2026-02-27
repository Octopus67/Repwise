import { create } from 'zustand';
import { Platform } from 'react-native';

// Types matching the calculation engine
export type Sex = 'male' | 'female' | 'other';
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'highly_active';
export type GoalType = 'lose_fat' | 'build_muscle' | 'maintain' | 'eat_healthier' | 'recomposition';
export type DietStyle = 'balanced' | 'high_protein' | 'low_carb' | 'keto';
export type ExerciseType = 'strength' | 'cardio' | 'sports' | 'yoga' | 'walking';

export interface OnboardingWizardState {
  currentStep: number;  // 1-9

  // Screen 1: Intent
  goalType: GoalType | null;

  // Screen 2: Body Basics
  sex: Sex;
  birthYear: number | null;
  birthMonth: number | null;
  heightCm: number;
  weightKg: number;
  unitSystem: 'metric' | 'imperial';

  // Screen 3: Body Composition
  bodyFatPct: number | null;
  bodyFatSkipped: boolean;

  // Screen 4: Lifestyle
  activityLevel: ActivityLevel;
  exerciseSessionsPerWeek: number;
  exerciseTypes: ExerciseType[];

  // Screen 5: TDEE (computed, not user input — but store the override)
  tdeeOverride: number | null;

  // Screen 6: Goal
  rateKgPerWeek: number;
  targetWeightKg: number | null;

  // Screen 7: Diet Style
  dietStyle: DietStyle;
  proteinPerKg: number;

  // Screen 8: Food DNA
  dietaryRestrictions: string[];
  allergies: string[];
  cuisinePreferences: string[];
  mealFrequency: number;
  foodDnaSkipped: boolean;

  // Fast Track (experienced users)
  manualCalories: number | null;
  manualProtein: number | null;
  manualCarbs: number | null;
  manualFat: number | null;
  fastTrackCompleted: boolean;
}

interface OnboardingWizardActions {
  setStep: (step: number) => void;
  updateField: <K extends keyof OnboardingWizardState>(key: K, value: OnboardingWizardState[K]) => void;
  reset: () => void;
}


const INITIAL_STATE: OnboardingWizardState = {
  currentStep: 1,
  goalType: null,
  sex: 'male',
  birthYear: null,
  birthMonth: null,
  heightCm: 170,
  weightKg: 70,
  unitSystem: 'metric',
  bodyFatPct: null,
  bodyFatSkipped: false,
  activityLevel: 'moderately_active',
  exerciseSessionsPerWeek: 3,
  exerciseTypes: [],
  tdeeOverride: null,
  rateKgPerWeek: 0.5,
  targetWeightKg: null,
  dietStyle: 'balanced',
  proteinPerKg: 2.0,
  dietaryRestrictions: [],
  allergies: [],
  cuisinePreferences: [],
  mealFrequency: 3,
  foodDnaSkipped: false,
  manualCalories: null,
  manualProtein: null,
  manualCarbs: null,
  manualFat: null,
  fastTrackCompleted: false,
};

const STORAGE_KEY = 'rw_onboarding_wizard_v2';

// Persistence helpers
function saveState(state: OnboardingWizardState) {
  try {
    const json = JSON.stringify(state);
    if (Platform.OS === 'web') {
      localStorage.setItem(STORAGE_KEY, json);
    }
    // Native: SecureStore is async, fire-and-forget
  } catch {}
}

function loadState(): Partial<OnboardingWizardState> | null {
  try {
    if (Platform.OS === 'web') {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    }
    return null;
  } catch {
    return null;
  }
}

function clearState() {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

export const useOnboardingStore = create<OnboardingWizardState & OnboardingWizardActions>((set, get) => {
  // Try to restore persisted state
  const saved = loadState();
  const initial = saved ? { ...INITIAL_STATE, ...saved } : INITIAL_STATE;

  return {
    ...initial,

    setStep: (step) => {
      set({ currentStep: step });
      saveState({ ...get(), currentStep: step });
    },

    updateField: (key, value) => {
      set({ [key]: value } as any);
      const newState = { ...get(), [key]: value };
      saveState(newState);
    },

    reset: () => {
      set(INITIAL_STATE);
      clearState();
    },
  };
});

// Helper to compute age from birth year/month
export function computeAge(birthYear: number | null, birthMonth: number | null): number {
  if (!birthYear) return 25; // default
  const now = new Date();
  let age = now.getFullYear() - birthYear;
  if (birthMonth && now.getMonth() + 1 < birthMonth) {
    age -= 1;
  }
  return Math.max(13, Math.min(120, age));
}