import {
  computeTDEEBreakdown,
  computeCalorieBudget,
  computeMacroSplit,
  type Sex,
  type ActivityLevel,
  type ExerciseType,
  type GoalType,
  type DietStyle,
} from '../../utils/onboardingCalculations';

// ─── 25 Diverse Profile Simulations ──────────────────────────────────────────

interface TestProfile {
  label: string;
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  sessionsPerWeek: number;
  exerciseTypes: ExerciseType[];
  bodyFatPct?: number;
  expectedTdeeMin: number;
  expectedTdeeMax: number;
}

const PROFILES: TestProfile[] = [
  { label: 'Sedentary office male 80kg', weightKg: 80, heightCm: 180, age: 25, sex: 'male', activityLevel: 'sedentary', sessionsPerWeek: 0, exerciseTypes: [], expectedTdeeMin: 1900, expectedTdeeMax: 2400 },
  { label: 'Sedentary office female 60kg', weightKg: 60, heightCm: 165, age: 30, sex: 'female', activityLevel: 'sedentary', sessionsPerWeek: 0, exerciseTypes: [], expectedTdeeMin: 1400, expectedTdeeMax: 1800 },
  { label: 'Light active male 75kg 3x str', weightKg: 75, heightCm: 175, age: 28, sex: 'male', activityLevel: 'lightly_active', sessionsPerWeek: 3, exerciseTypes: ['strength'], expectedTdeeMin: 2200, expectedTdeeMax: 2700 },
  { label: 'Mod active male 80kg 4x str', weightKg: 80, heightCm: 180, age: 25, sex: 'male', activityLevel: 'moderately_active', sessionsPerWeek: 4, exerciseTypes: ['strength'], expectedTdeeMin: 2600, expectedTdeeMax: 3100 },
  { label: 'Mod active female 65kg 4x cardio', weightKg: 65, heightCm: 168, age: 27, sex: 'female', activityLevel: 'moderately_active', sessionsPerWeek: 4, exerciseTypes: ['cardio'], expectedTdeeMin: 2000, expectedTdeeMax: 2500 },
  { label: 'Highly active male 90kg 6x mix', weightKg: 90, heightCm: 185, age: 22, sex: 'male', activityLevel: 'highly_active', sessionsPerWeek: 6, exerciseTypes: ['strength', 'cardio'], expectedTdeeMin: 3200, expectedTdeeMax: 3900 },
  { label: 'Sedentary female 55kg none', weightKg: 55, heightCm: 160, age: 35, sex: 'female', activityLevel: 'sedentary', sessionsPerWeek: 0, exerciseTypes: [], expectedTdeeMin: 1300, expectedTdeeMax: 1700 },
  { label: 'Teen male 60kg 3x sports', weightKg: 60, heightCm: 170, age: 16, sex: 'male', activityLevel: 'moderately_active', sessionsPerWeek: 3, exerciseTypes: ['sports'], expectedTdeeMin: 2100, expectedTdeeMax: 2700 },
  { label: 'Older male 75kg 2x walk', weightKg: 75, heightCm: 172, age: 55, sex: 'male', activityLevel: 'lightly_active', sessionsPerWeek: 2, exerciseTypes: ['walking'], expectedTdeeMin: 1900, expectedTdeeMax: 2400 },
  { label: 'Older female 65kg sedentary', weightKg: 65, heightCm: 162, age: 60, sex: 'female', activityLevel: 'sedentary', sessionsPerWeek: 0, exerciseTypes: [], expectedTdeeMin: 1300, expectedTdeeMax: 1700 },
  { label: 'Lean female 52kg 5x yoga+cardio', weightKg: 52, heightCm: 163, age: 25, sex: 'female', activityLevel: 'lightly_active', sessionsPerWeek: 5, exerciseTypes: ['yoga', 'cardio'], expectedTdeeMin: 1600, expectedTdeeMax: 2100 },
  { label: 'Overweight male 110kg sedentary', weightKg: 110, heightCm: 178, age: 40, sex: 'male', activityLevel: 'sedentary', sessionsPerWeek: 0, exerciseTypes: [], expectedTdeeMin: 2200, expectedTdeeMax: 2800 },
  { label: 'Petite female 48kg 3x yoga', weightKg: 48, heightCm: 155, age: 28, sex: 'female', activityLevel: 'lightly_active', sessionsPerWeek: 3, exerciseTypes: ['yoga'], expectedTdeeMin: 1400, expectedTdeeMax: 1800 },
  { label: 'Tall male 85kg 5x cardio', weightKg: 85, heightCm: 193, age: 24, sex: 'male', activityLevel: 'moderately_active', sessionsPerWeek: 5, exerciseTypes: ['cardio'], expectedTdeeMin: 2800, expectedTdeeMax: 3500 },
  { label: 'Average male 70kg 3x str', weightKg: 70, heightCm: 175, age: 30, sex: 'male', activityLevel: 'moderately_active', sessionsPerWeek: 3, exerciseTypes: ['strength'], expectedTdeeMin: 2200, expectedTdeeMax: 2800 },
  { label: 'Average female 60kg 3x cardio', weightKg: 60, heightCm: 165, age: 30, sex: 'female', activityLevel: 'moderately_active', sessionsPerWeek: 3, exerciseTypes: ['cardio'], expectedTdeeMin: 1800, expectedTdeeMax: 2300 },
  { label: 'Heavy male 95kg highly active', weightKg: 95, heightCm: 180, age: 28, sex: 'male', activityLevel: 'highly_active', sessionsPerWeek: 5, exerciseTypes: ['strength', 'sports'], expectedTdeeMin: 3200, expectedTdeeMax: 3900 },
  { label: 'Light female 50kg sedentary', weightKg: 50, heightCm: 158, age: 22, sex: 'female', activityLevel: 'sedentary', sessionsPerWeek: 0, exerciseTypes: [], expectedTdeeMin: 1300, expectedTdeeMax: 1700 },
  { label: 'Female 60kg 4x mixed', weightKg: 60, heightCm: 165, age: 25, sex: 'female', activityLevel: 'moderately_active', sessionsPerWeek: 4, exerciseTypes: ['strength', 'cardio'], expectedTdeeMin: 1900, expectedTdeeMax: 2400 },
  { label: 'Male 70kg 2x walk sedentary', weightKg: 70, heightCm: 175, age: 45, sex: 'male', activityLevel: 'sedentary', sessionsPerWeek: 2, exerciseTypes: ['walking'], expectedTdeeMin: 1700, expectedTdeeMax: 2200 },
  { label: 'Female 55kg highly active 6x', weightKg: 55, heightCm: 162, age: 23, sex: 'female', activityLevel: 'highly_active', sessionsPerWeek: 6, exerciseTypes: ['cardio', 'strength'], expectedTdeeMin: 2000, expectedTdeeMax: 2600 },
  { label: 'Male 85kg light 1x yoga', weightKg: 85, heightCm: 180, age: 35, sex: 'male', activityLevel: 'lightly_active', sessionsPerWeek: 1, exerciseTypes: ['yoga'], expectedTdeeMin: 2200, expectedTdeeMax: 2700 },
  { label: 'Male 80kg BF20%', weightKg: 80, heightCm: 180, age: 25, sex: 'male', activityLevel: 'moderately_active', sessionsPerWeek: 4, exerciseTypes: ['strength'], bodyFatPct: 20, expectedTdeeMin: 2500, expectedTdeeMax: 3000 },
  { label: 'Male 80kg BF10%', weightKg: 80, heightCm: 180, age: 25, sex: 'male', activityLevel: 'moderately_active', sessionsPerWeek: 4, exerciseTypes: ['strength'], bodyFatPct: 10, expectedTdeeMin: 2700, expectedTdeeMax: 3200 },
  { label: 'Bodybuilder 100kg BF12%', weightKg: 100, heightCm: 183, age: 30, sex: 'male', activityLevel: 'lightly_active', sessionsPerWeek: 6, exerciseTypes: ['strength'], bodyFatPct: 12, expectedTdeeMin: 3000, expectedTdeeMax: 3700 },
];


// ─── TDEE Breakdown Simulations ──────────────────────────────────────────────

describe('TDEE Simulation — 25 profiles', () => {
  test.each(PROFILES)(
    '$label → TDEE between $expectedTdeeMin and $expectedTdeeMax',
    (profile) => {
      const result = computeTDEEBreakdown(
        profile.weightKg,
        profile.heightCm,
        profile.age,
        profile.sex,
        profile.activityLevel,
        profile.sessionsPerWeek,
        profile.exerciseTypes,
        profile.bodyFatPct,
      );

      // Total TDEE within expected range
      expect(result.total).toBeGreaterThanOrEqual(profile.expectedTdeeMin);
      expect(result.total).toBeLessThanOrEqual(profile.expectedTdeeMax);

      // Components must sum to total
      expect(result.bmr + result.neat + result.eat + result.tef).toBe(result.total);

      // BMR must be positive
      expect(result.bmr).toBeGreaterThan(0);

      // All components must be non-negative
      expect(result.bmr).toBeGreaterThanOrEqual(0);
      expect(result.neat).toBeGreaterThanOrEqual(0);
      expect(result.eat).toBeGreaterThanOrEqual(0);
      expect(result.tef).toBeGreaterThanOrEqual(0);
    },
  );
});

// ─── Calorie Budget Tests ────────────────────────────────────────────────────

describe('Calorie Budget — goal variations', () => {
  // Use a representative male profile: moderately active, 80kg, TDEE ~2800
  const maleTdee = computeTDEEBreakdown(80, 180, 25, 'male', 'moderately_active', 4, ['strength']).total;
  // Use a representative female profile: lightly active, 60kg, TDEE ~1900
  const femaleTdee = computeTDEEBreakdown(60, 165, 30, 'female', 'lightly_active', 3, ['cardio']).total;

  test('lose_fat creates a deficit below TDEE', () => {
    const result = computeCalorieBudget(maleTdee, 'lose_fat', 0.5, 'male');
    expect(result.budget).toBeLessThan(maleTdee);
    expect(result.deficit).toBeGreaterThan(0);
    expect(result.budget).toBeGreaterThanOrEqual(1500); // male floor
  });

  test('build_muscle creates a surplus above TDEE', () => {
    const result = computeCalorieBudget(maleTdee, 'build_muscle', 0.25, 'male');
    expect(result.budget).toBeGreaterThan(maleTdee);
    expect(result.deficit).toBeGreaterThan(0); // deficit field holds the rate-based value
  });

  test('maintain keeps budget equal to TDEE', () => {
    const result = computeCalorieBudget(femaleTdee, 'maintain', 0, 'female');
    expect(result.budget).toBe(Math.round(femaleTdee));
    expect(result.floorApplied).toBe(false);
  });

  test('aggressive fat loss triggers calorie floor for female', () => {
    // Very low TDEE female with aggressive cut
    const lowTdee = 1400;
    const result = computeCalorieBudget(lowTdee, 'lose_fat', 1.0, 'female');
    expect(result.floorApplied).toBe(true);
    expect(result.budget).toBe(1200); // female floor
  });

  test('aggressive fat loss triggers calorie floor for male', () => {
    const lowTdee = 1800;
    const result = computeCalorieBudget(lowTdee, 'lose_fat', 1.0, 'male');
    expect(result.floorApplied).toBe(true);
    expect(result.budget).toBe(1500); // male floor
  });

  test('moderate deficit does not trigger floor', () => {
    const result = computeCalorieBudget(maleTdee, 'lose_fat', 0.5, 'male');
    expect(result.floorApplied).toBe(false);
    // deficit = 0.5 * 7700 / 7 = 550
    expect(result.deficit).toBe(550);
  });
});

// ─── Macro Split Tests ───────────────────────────────────────────────────────

describe('Macro Split — diet style variations', () => {
  const budget = 2500;
  const weightKg = 80;
  const proteinPerKg = 2.0;

  test('balanced split has more carbs than fat', () => {
    const result = computeMacroSplit(budget, weightKg, proteinPerKg, 'balanced');
    expect(result.proteinG).toBe(160); // 80 * 2.0
    expect(result.proteinKcal).toBe(640); // 160 * 4
    expect(result.carbsG).toBeGreaterThan(result.fatG);
    // All macros positive
    expect(result.carbsG).toBeGreaterThan(0);
    expect(result.fatG).toBeGreaterThan(0);
  });

  test('keto split has very low carbs and high fat', () => {
    const result = computeMacroSplit(budget, weightKg, proteinPerKg, 'keto');
    expect(result.proteinG).toBe(160);
    expect(result.fatG).toBeGreaterThan(result.carbsG);
    // Keto: carbs should be very low (10% of remaining)
    expect(result.carbsG).toBeLessThan(60);
  });

  test('high_protein split has equal carb/fat calorie ratio', () => {
    const result = computeMacroSplit(budget, weightKg, proteinPerKg, 'high_protein');
    expect(result.proteinG).toBe(160);
    // 50/50 split of remaining calories between carbs and fat
    // Carb kcal and fat kcal should be roughly equal (within rounding)
    expect(Math.abs(result.carbsKcal - result.fatKcal)).toBeLessThan(50);
  });

  test('low_carb split has more fat than carbs', () => {
    const result = computeMacroSplit(budget, weightKg, proteinPerKg, 'low_carb');
    expect(result.fatG).toBeGreaterThan(result.carbsG);
  });

  test('fat floor is enforced for very high protein budget', () => {
    // With very high protein, remaining calories are small → fat might go below floor
    const result = computeMacroSplit(1800, 80, 2.5, 'balanced');
    const minFat = Math.round(80 * 0.6); // 48g
    expect(result.fatG).toBeGreaterThanOrEqual(minFat);
  });

  test('macro kcal values are consistent with gram values', () => {
    const result = computeMacroSplit(budget, weightKg, proteinPerKg, 'balanced');
    expect(result.proteinKcal).toBe(result.proteinG * 4);
    // fatKcal and carbsKcal may have rounding differences, check within 10 kcal
    expect(Math.abs(result.fatKcal - result.fatG * 9)).toBeLessThanOrEqual(10);
    expect(Math.abs(result.carbsKcal - result.carbsG * 4)).toBeLessThanOrEqual(10);
  });
});
