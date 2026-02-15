/**
 * Onboarding Step Logic Tests
 *
 * Tests the business logic of each onboarding step screen:
 * store interactions, validation, and calculation functions.
 * No React rendering — pure logic only.
 */

// Mock react-native Platform
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

import { useOnboardingStore, computeAge } from '../../store/onboardingSlice';
import {
  computeBMR, computeNEAT, computeEAT, computeTEF,
  computeTDEEBreakdown, computeCalorieBudget, computeMacroSplit,
  estimateBodyFat, getProteinRecommendation,
} from '../../utils/onboardingCalculations';

function getState() {
  return useOnboardingStore.getState();
}

beforeEach(() => {
  localStorageMock.clear();
  getState().reset();
});

// ─── 1. IntentStep logic ────────────────────────────────────────────────────

describe('IntentStep logic', () => {
  test('goalType is null initially', () => {
    expect(getState().goalType).toBeNull();
  });

  test('setting goalType to lose_fat stores correctly', () => {
    getState().updateField('goalType', 'lose_fat');
    expect(getState().goalType).toBe('lose_fat');
  });

  test('setting goalType to build_muscle stores correctly', () => {
    getState().updateField('goalType', 'build_muscle');
    expect(getState().goalType).toBe('build_muscle');
  });

  test('setting goalType to maintain stores correctly', () => {
    getState().updateField('goalType', 'maintain');
    expect(getState().goalType).toBe('maintain');
  });

  test('setting goalType to eat_healthier stores correctly', () => {
    getState().updateField('goalType', 'eat_healthier');
    expect(getState().goalType).toBe('eat_healthier');
  });
});


// ─── 2. BodyBasicsStep validation ───────────────────────────────────────────

describe('BodyBasicsStep validation', () => {
  test('canProceed is false when birthYear is null (even though sex defaults to male)', () => {
    // sex defaults to 'male', but birthYear is null → cannot proceed
    const s = getState();
    const canProceed = s.birthYear !== null && s.birthYear > 1900;
    expect(canProceed).toBe(false);
  });

  test('canProceed is false when birthYear is null explicitly', () => {
    getState().updateField('birthYear', null);
    const canProceed = getState().birthYear !== null;
    expect(canProceed).toBe(false);
  });

  test('canProceed is false when birthYear <= 1900', () => {
    getState().updateField('birthYear', 1900);
    const canProceed = getState().birthYear !== null && getState().birthYear! > 1900;
    expect(canProceed).toBe(false);
  });

  test('setting birthYear and birthMonth updates store', () => {
    getState().updateField('birthYear', 1995);
    getState().updateField('birthMonth', 6);
    expect(getState().birthYear).toBe(1995);
    expect(getState().birthMonth).toBe(6);
  });

  test('computeAge returns correct age for various birth years', () => {
    const now = new Date();
    const currentYear = now.getFullYear();

    // Born in 2000, month already passed → full years
    const age2000 = computeAge(2000, 1);
    expect(age2000).toBe(currentYear - 2000);

    // Null birthYear → default 25
    expect(computeAge(null, null)).toBe(25);

    // Very old → clamped to 120
    expect(computeAge(1900, 1)).toBe(120);

    // Future year → clamped to 13
    expect(computeAge(currentYear + 5, 1)).toBe(13);
  });
});

// ─── 3. BodyMeasurementsStep logic ──────────────────────────────────────────

describe('BodyMeasurementsStep logic', () => {
  test('default heightCm is 170, weightKg is 70', () => {
    expect(getState().heightCm).toBe(170);
    expect(getState().weightKg).toBe(70);
  });

  test('changing heightCm updates BMR', () => {
    const age = 25;
    const bmr170 = computeBMR(70, 170, age, 'male');
    const bmr180 = computeBMR(70, 180, age, 'male');
    expect(bmr170).not.toBe(bmr180);
    // Taller → higher BMR
    expect(bmr180).toBeGreaterThan(bmr170);
  });

  test('changing weightKg updates BMR', () => {
    const age = 25;
    const bmr70 = computeBMR(70, 170, age, 'male');
    const bmr90 = computeBMR(90, 170, age, 'male');
    expect(bmr70).not.toBe(bmr90);
    // Heavier → higher BMR
    expect(bmr90).toBeGreaterThan(bmr70);
  });

  test('unit conversion: 170cm → 67 inches', () => {
    const inches = Math.round(170 / 2.54);
    expect(inches).toBe(67);
  });

  test('unit conversion: 70kg → 154.3 lbs', () => {
    const lbs = Math.round(70 * 2.20462 * 10) / 10;
    expect(lbs).toBeCloseTo(154.3, 1);
  });
});

// ─── 4. BodyCompositionStep logic ───────────────────────────────────────────

describe('BodyCompositionStep logic', () => {
  test('selecting a body fat range sets bodyFatPct to midpoint', () => {
    // Simulate selecting 15-20% range → midpoint 17.5
    const rangeLow = 15;
    const rangeHigh = 20;
    const midpoint = (rangeLow + rangeHigh) / 2;
    getState().updateField('bodyFatPct', midpoint);
    expect(getState().bodyFatPct).toBe(17.5);
  });

  test('skipping sets bodyFatSkipped=true and uses auto-estimate', () => {
    getState().updateField('bodyFatSkipped', true);
    expect(getState().bodyFatSkipped).toBe(true);
    expect(getState().bodyFatPct).toBeNull();

    // Auto-estimate would be used instead
    const estimate = estimateBodyFat(70, 170, 'male');
    expect(estimate.estimate).toBeGreaterThan(0);
  });

  test('estimateBodyFat returns reasonable values for male/female', () => {
    const male = estimateBodyFat(80, 175, 'male');
    expect(male.estimate).toBeGreaterThanOrEqual(10);
    expect(male.estimate).toBeLessThanOrEqual(35);
    expect(male.high).toBe(male.estimate + 4);
    expect(male.low).toBe(male.estimate - 4);

    const female = estimateBodyFat(65, 165, 'female');
    expect(female.estimate).toBeGreaterThanOrEqual(18);
    expect(female.estimate).toBeLessThanOrEqual(42);
    // Female estimate should be higher than male for similar BMI
    expect(female.estimate).toBeGreaterThan(male.estimate);
  });

  test('auto-estimate for 80kg/180cm male → ~18%', () => {
    // BMI = 80 / (1.8^2) = 80 / 3.24 ≈ 24.7 → falls in 20-25 range → 18%
    const estimate = estimateBodyFat(80, 180, 'male');
    expect(estimate.estimate).toBe(18);
  });
});


// ─── 5. LifestyleStep logic ─────────────────────────────────────────────────

describe('LifestyleStep logic', () => {
  test('changing activityLevel changes NEAT', () => {
    const bmr = 1700;
    const neatSedentary = computeNEAT(bmr, 'sedentary', 80);
    const neatActive = computeNEAT(bmr, 'highly_active', 80);
    expect(neatActive).toBeGreaterThan(neatSedentary);
    // sedentary 80kg: 2.5*80=200, highly_active 80kg: 11*80=880
    expect(neatSedentary).toBe(200);
    expect(neatActive).toBe(880);
  });

  test('changing exerciseTypes changes EAT', () => {
    const eatStrength = computeEAT(80, 4, ['strength']);
    const eatCardio = computeEAT(80, 4, ['cardio']);
    expect(eatStrength).not.toBe(eatCardio);
    // Cardio burns more per session than strength
    expect(eatCardio).toBeGreaterThan(eatStrength);
  });

  test('NEAT + EAT for sedentary 0 sessions is just NEAT', () => {
    const bmr = 1700;
    const neat = computeNEAT(bmr, 'sedentary', 80);
    const eat = computeEAT(80, 0, []);
    // 0 sessions → EAT should be 0
    expect(eat).toBe(0);
    const total = neat + eat;
    expect(total).toBe(neat);
  });

  test('NEAT + EAT for moderately_active 4x strength is reasonable (~750 for 80kg)', () => {
    const bmr = 1700;
    const neat = computeNEAT(bmr, 'moderately_active', 80);
    const eat = computeEAT(80, 4, ['strength']);
    // NEAT: 7.5*80=600, EAT: 4 * (80*5*0.67) / 7 ≈ 4*268/7 ≈ 153
    const combined = neat + eat;
    expect(combined).toBeGreaterThan(700);
    expect(combined).toBeLessThan(850);
  });

  test('toggling exercise type adds/removes from array', () => {
    // Simulate toggle logic
    let types: string[] = [];

    // Add strength
    types = [...types, 'strength'];
    expect(types).toContain('strength');

    // Add cardio
    types = [...types, 'cardio'];
    expect(types).toEqual(['strength', 'cardio']);

    // Remove strength (toggle off)
    types = types.filter(t => t !== 'strength');
    expect(types).toEqual(['cardio']);

    // Store it
    getState().updateField('exerciseTypes', types as any);
    expect(getState().exerciseTypes).toEqual(['cardio']);
  });
});

// ─── 6. GoalStep logic ──────────────────────────────────────────────────────

describe('GoalStep logic', () => {
  const tdee = 2500;

  test('lose_fat with rate 0.5 → budget < TDEE', () => {
    const result = computeCalorieBudget(tdee, 'lose_fat', 0.5, 'male');
    expect(result.budget).toBeLessThan(tdee);
    // deficit = 0.5 * 7700 / 7 = 550
    expect(result.deficit).toBe(550);
    expect(result.budget).toBe(tdee - 550);
  });

  test('build_muscle with rate 0.25 → budget > TDEE', () => {
    const result = computeCalorieBudget(tdee, 'build_muscle', 0.25, 'male');
    expect(result.budget).toBeGreaterThan(tdee);
    // surplus = 0.25 * 7700 / 7 = 275
    expect(result.deficit).toBe(275);
    expect(result.budget).toBe(tdee + 275);
  });

  test('maintain → budget === TDEE', () => {
    const result = computeCalorieBudget(tdee, 'maintain', 0.5, 'male');
    expect(result.budget).toBe(tdee);
  });

  test('calorie floor applied for aggressive deficit', () => {
    // Small TDEE with aggressive cut → floor kicks in
    const result = computeCalorieBudget(1800, 'lose_fat', 1.0, 'female');
    // deficit = 1.0 * 7700 / 7 = 1100 → budget = 1800 - 1100 = 700 → floor 1200
    expect(result.floorApplied).toBe(true);
    expect(result.budget).toBe(1200);
  });
});

// ─── 7. DietStyleStep logic ─────────────────────────────────────────────────

describe('DietStyleStep logic', () => {
  test('balanced macro split: protein + carbs + fat kcal ≈ budget', () => {
    const budget = 2200;
    const macros = computeMacroSplit(budget, 80, 2.0, 'balanced');
    const totalKcal = macros.proteinG * 4 + macros.carbsG * 4 + macros.fatG * 9;
    // Allow rounding tolerance
    expect(Math.abs(totalKcal - budget)).toBeLessThan(25);
  });

  test('keto: carbs < 50g for typical budget', () => {
    const budget = 2200;
    const macros = computeMacroSplit(budget, 80, 2.0, 'keto');
    expect(macros.carbsG).toBeLessThan(50);
    // Keto should have high fat
    expect(macros.fatG).toBeGreaterThan(100);
  });

  test('protein recommendation for lose_fat + strength → min 2.0', () => {
    const rec = getProteinRecommendation('lose_fat', ['strength']);
    expect(rec.min).toBe(2.0);
    expect(rec.max).toBe(2.4);
    expect(rec.default).toBe(2.2);
  });

  test('changing proteinPerKg changes macro split', () => {
    const budget = 2200;
    const macrosLow = computeMacroSplit(budget, 80, 1.6, 'balanced');
    const macrosHigh = computeMacroSplit(budget, 80, 2.4, 'balanced');
    // Higher protein → more protein grams, fewer carbs/fat
    expect(macrosHigh.proteinG).toBeGreaterThan(macrosLow.proteinG);
    expect(macrosHigh.carbsG).toBeLessThan(macrosLow.carbsG);
  });
});


// ─── 8. Full wizard flow simulation ─────────────────────────────────────────

describe('Full wizard flow simulation', () => {
  test('complete flow: set all fields → compute TDEE → budget → macros → all reasonable', () => {
    // Step 1: Intent
    getState().updateField('goalType', 'lose_fat');

    // Step 2: Body Basics
    getState().updateField('sex', 'male');
    getState().updateField('birthYear', 1995);
    getState().updateField('birthMonth', 6);

    // Step 3: Body Measurements
    getState().updateField('heightCm', 180);
    getState().updateField('weightKg', 85);

    // Step 4: Body Composition
    getState().updateField('bodyFatPct', 20);

    // Step 5: Lifestyle
    getState().updateField('activityLevel', 'moderately_active');
    getState().updateField('exerciseSessionsPerWeek', 4);
    getState().updateField('exerciseTypes', ['strength', 'cardio']);

    // Step 6: Goal
    getState().updateField('rateKgPerWeek', 0.5);

    // Step 7: Diet Style
    getState().updateField('dietStyle', 'balanced');
    getState().updateField('proteinPerKg', 2.0);

    const s = getState();
    const age = computeAge(s.birthYear, s.birthMonth);

    // Compute TDEE
    const tdee = computeTDEEBreakdown(
      s.weightKg, s.heightCm, age, s.sex,
      s.activityLevel, s.exerciseSessionsPerWeek,
      s.exerciseTypes, s.bodyFatPct ?? undefined,
    );
    expect(tdee.total).toBeGreaterThan(2000);
    expect(tdee.total).toBeLessThan(4000);
    expect(tdee.bmr).toBeGreaterThan(1400);

    // Compute budget
    const budget = computeCalorieBudget(tdee.total, s.goalType!, s.rateKgPerWeek, s.sex);
    expect(budget.budget).toBeLessThan(tdee.total); // lose_fat → deficit
    expect(budget.budget).toBeGreaterThan(1200);

    // Compute macros
    const macros = computeMacroSplit(budget.budget, s.weightKg, s.proteinPerKg, s.dietStyle);
    expect(macros.proteinG).toBe(170); // 85 * 2.0
    expect(macros.carbsG).toBeGreaterThan(0);
    expect(macros.fatG).toBeGreaterThan(0);

    // Total kcal from macros ≈ budget
    const totalKcal = macros.proteinG * 4 + macros.carbsG * 4 + macros.fatG * 9;
    expect(Math.abs(totalKcal - budget.budget)).toBeLessThan(25);
  });

  test('fast track flow: set manual macros → fastTrackCompleted = true', () => {
    getState().updateField('manualCalories', 2200);
    getState().updateField('manualProtein', 180);
    getState().updateField('manualCarbs', 200);
    getState().updateField('manualFat', 70);
    getState().updateField('fastTrackCompleted', true);

    const s = getState();
    expect(s.fastTrackCompleted).toBe(true);
    expect(s.manualCalories).toBe(2200);
    expect(s.manualProtein).toBe(180);
    expect(s.manualCarbs).toBe(200);
    expect(s.manualFat).toBe(70);

    // Verify macro kcal is close to manual calories
    const macroKcal = s.manualProtein! * 4 + s.manualCarbs! * 4 + s.manualFat! * 9;
    // 180*4 + 200*4 + 70*9 = 720 + 800 + 630 = 2150 (close to 2200)
    expect(Math.abs(macroKcal - s.manualCalories!)).toBeLessThan(100);
  });

  test('skip optional screens: bodyFatSkipped + foodDnaSkipped → defaults applied, TDEE computable', () => {
    // Set required fields only
    getState().updateField('goalType', 'maintain');
    getState().updateField('sex', 'female');
    getState().updateField('birthYear', 1990);
    getState().updateField('heightCm', 165);
    getState().updateField('weightKg', 60);
    getState().updateField('activityLevel', 'lightly_active');
    getState().updateField('exerciseSessionsPerWeek', 2);
    getState().updateField('exerciseTypes', ['yoga']);

    // Skip optional screens
    getState().updateField('bodyFatSkipped', true);
    getState().updateField('foodDnaSkipped', true);

    const s = getState();
    expect(s.bodyFatSkipped).toBe(true);
    expect(s.foodDnaSkipped).toBe(true);
    expect(s.bodyFatPct).toBeNull();
    expect(s.dietaryRestrictions).toEqual([]);

    // TDEE should still be computable (Mifflin-St Jeor, no body fat)
    const age = computeAge(s.birthYear, s.birthMonth);
    const tdee = computeTDEEBreakdown(
      s.weightKg, s.heightCm, age, s.sex,
      s.activityLevel, s.exerciseSessionsPerWeek,
      s.exerciseTypes, undefined, // bodyFat skipped
    );
    expect(tdee.total).toBeGreaterThan(1200);
    expect(tdee.total).toBeLessThan(3000);
    expect(tdee.bmr).toBeGreaterThan(0);

    // Budget for maintain = TDEE
    const budget = computeCalorieBudget(tdee.total, s.goalType!, s.rateKgPerWeek, s.sex);
    expect(budget.budget).toBe(tdee.total);
  });
});
