// ─── Types ────────────────────────────────────────────────────────────────────

export type Sex = 'male' | 'female' | 'other';
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'highly_active';
export type GoalType = 'lose_fat' | 'build_muscle' | 'maintain' | 'eat_healthier';
export type DietStyle = 'balanced' | 'high_protein' | 'low_carb' | 'keto';
export type ExerciseType = 'strength' | 'cardio' | 'sports' | 'yoga' | 'walking';

export interface TDEEBreakdown {
  bmr: number;
  neat: number;
  eat: number;
  tef: number;
  total: number;
}

export interface CalorieBudget {
  budget: number;
  deficit: number;
  floorApplied: boolean;
}

export interface MacroSplit {
  proteinG: number;
  carbsG: number;
  fatG: number;
  proteinKcal: number;
  carbsKcal: number;
  fatKcal: number;
}

export interface BodyFatEstimate {
  estimate: number;
  low: number;
  high: number;
}

export interface ProteinRecommendation {
  min: number;
  max: number;
  default: number;
}

// ─── Function 1: computeBMR ──────────────────────────────────────────────────

/**
 * Computes Basal Metabolic Rate using Mifflin-St Jeor or Katch-McArdle formula.
 *
 * - Mifflin-St Jeor is used when body fat percentage is not provided.
 *   Male:   BMR = (10 × weight_kg) + (6.25 × height_cm) - (5 × age) + 5
 *   Female: BMR = (10 × weight_kg) + (6.25 × height_cm) - (5 × age) - 161
 *   Other:  average of male and female results
 *
 * - Katch-McArdle is used when body fat percentage IS provided:
 *   BMR = 370 + (21.6 × lean_mass), where lean_mass = weight_kg × (1 - bodyFatPct / 100)
 *
 * @param weightKg  Body weight in kilograms
 * @param heightCm  Height in centimeters
 * @param age       Age in years
 * @param sex       Biological sex: 'male' | 'female' | 'other'
 * @param bodyFatPct Optional body fat percentage (0-100)
 * @returns BMR in kcal/day, rounded. Returns 0 for invalid inputs.
 */
export function computeBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex,
  bodyFatPct?: number,
): number {
  if (weightKg <= 0 || heightCm <= 0 || age <= 0) return 0;

  // When body fat is known, use Katch-McArdle (most accurate for lean/muscular individuals)
  if (bodyFatPct !== undefined && bodyFatPct !== null) {
    const leanMass = weightKg * (1 - bodyFatPct / 100);
    return Math.round(370 + 21.6 * leanMass);
  }

  // When body fat is NOT known, use Mifflin-St Jeor (accounts for height, weight, age, sex)
  // This formula inherently accounts for typical body composition at a given height/weight
  const maleBMR = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  const femaleBMR = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  switch (sex) {
    case 'male':
      return Math.round(maleBMR);
    case 'female':
      return Math.round(femaleBMR);
    case 'other':
      return Math.round((maleBMR + femaleBMR) / 2);
  }
}

// ─── Function 2: computeNEAT ─────────────────────────────────────────────────

/**
 * Computes Non-Exercise Activity Thermogenesis from BMR and activity level.
 *
 * NEAT represents calories burned through daily non-exercise movement:
 * fidgeting, walking around the house, standing, etc.
 *
 * Typical NEAT values:
 *   sedentary:         ~200 kcal/day (desk job, minimal movement)
 *   lightly_active:    ~400 kcal/day (some walking, light chores)
 *   moderately_active: ~600 kcal/day (active job, regular movement)
 *   highly_active:     ~900 kcal/day (manual labor, on feet all day)
 *
 * We scale by body weight since heavier people burn more moving around.
 * Base NEAT per kg, then multiplied by weight.
 *
 * @param bmr           Basal Metabolic Rate in kcal/day (unused, kept for API compat)
 * @param activityLevel Daily activity level outside of exercise
 * @param weightKg      Body weight in kg (optional, defaults to 70)
 * @returns NEAT in kcal/day, rounded
 */
export function computeNEAT(bmr: number, activityLevel: ActivityLevel, weightKg: number = 70): number {
  // kcal per kg per day for non-exercise activity
  const kcalPerKg: Record<ActivityLevel, number> = {
    sedentary: 2.5,          // ~175 for 70kg, ~200 for 80kg
    lightly_active: 5.0,     // ~350 for 70kg, ~400 for 80kg
    moderately_active: 7.5,  // ~525 for 70kg, ~600 for 80kg
    highly_active: 11.0,     // ~770 for 70kg, ~880 for 80kg
  };
  return Math.round(kcalPerKg[activityLevel] * weightKg);
}

// ─── Function 3: computeEAT ──────────────────────────────────────────────────

/**
 * Computes Exercise Activity Thermogenesis — daily calories burned through exercise.
 *
 * Per-session burn estimates based on MET research for a typical session duration:
 *   strength: ~250 kcal/session for 80kg (60min moderate resistance, MET ~5)
 *   cardio:   ~400 kcal/session for 80kg (45min running/cycling, MET ~8)
 *   sports:   ~350 kcal/session for 80kg (60min team sports, MET ~6)
 *   yoga:     ~150 kcal/session for 80kg (60min vinyasa, MET ~3)
 *   walking:  ~200 kcal/session for 80kg (60min brisk walk, MET ~4)
 *
 * Formula: MET × weightKg × durationHours
 * Weekly EAT = sessions_per_week × burn_per_session
 * Daily EAT = Math.round(weekly / 7)
 * Falls back to 'strength' if exerciseTypes is empty.
 *
 * @param weightKg        Body weight in kilograms
 * @param sessionsPerWeek Number of exercise sessions per week
 * @param exerciseTypes   Array of exercise types performed
 * @returns Daily EAT in kcal, rounded
 */
export function computeEAT(
  weightKg: number,
  sessionsPerWeek: number,
  exerciseTypes: ExerciseType[],
): number {
  // MET × duration(hours) per session type
  const burnPerSession: Record<ExerciseType, number> = {
    strength: weightKg * 5.0 * 0.67,   // MET 5, 40min effective → ~267 for 80kg
    cardio:   weightKg * 8.0 * 0.67,   // MET 8, 40min effective → ~427 for 80kg
    sports:   weightKg * 6.0 * 0.75,   // MET 6, 45min effective → ~360 for 80kg
    yoga:     weightKg * 3.0 * 0.67,   // MET 3, 40min effective → ~160 for 80kg
    walking:  weightKg * 3.5 * 0.75,   // MET 3.5, 45min effective → ~210 for 80kg
  };

  const types = exerciseTypes.length > 0 ? exerciseTypes : (['strength'] as ExerciseType[]);
  const avgBurn = types.reduce((sum, t) => sum + burnPerSession[t], 0) / types.length;
  const weeklyEAT = sessionsPerWeek * avgBurn;
  return Math.round(weeklyEAT / 7);
}

// ─── Function 4: computeTEF ──────────────────────────────────────────────────

/**
 * Computes the Thermic Effect of Food — energy spent digesting food.
 *
 * TEF = 10% of (BMR + NEAT + EAT)
 *
 * @param bmr  Basal Metabolic Rate in kcal/day
 * @param neat Non-Exercise Activity Thermogenesis in kcal/day
 * @param eat  Exercise Activity Thermogenesis in kcal/day
 * @returns TEF in kcal/day, rounded
 */
export function computeTEF(bmr: number, neat: number, eat: number): number {
  return Math.round((bmr + neat + eat) * 0.10);
}

// ─── Function 5: computeTDEEBreakdown ────────────────────────────────────────

/**
 * Orchestrates the full TDEE calculation by calling computeBMR, computeNEAT,
 * computeEAT, and computeTEF, then summing all components.
 *
 * @param weightKg        Body weight in kilograms
 * @param heightCm        Height in centimeters
 * @param age             Age in years
 * @param sex             Biological sex
 * @param activityLevel   Daily activity level
 * @param sessionsPerWeek Exercise sessions per week
 * @param exerciseTypes   Types of exercise performed
 * @param bodyFatPct      Optional body fat percentage
 * @returns Full TDEE breakdown: { bmr, neat, eat, tef, total }
 */
export function computeTDEEBreakdown(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex,
  activityLevel: ActivityLevel,
  sessionsPerWeek: number,
  exerciseTypes: ExerciseType[],
  bodyFatPct?: number,
): TDEEBreakdown {
  const bmr = computeBMR(weightKg, heightCm, age, sex, bodyFatPct);
  const neat = computeNEAT(bmr, activityLevel, weightKg);
  const eat = computeEAT(weightKg, sessionsPerWeek, exerciseTypes);
  const tef = computeTEF(bmr, neat, eat);
  const total = bmr + neat + eat + tef;
  return { bmr, neat, eat, tef, total };
}

// ─── Function 6: computeCalorieBudget ────────────────────────────────────────

/**
 * Computes the daily calorie budget based on TDEE, goal, and weekly rate.
 *
 * - lose_fat:      budget = tdee - deficit  (deficit = rate_kg/wk × 7700 / 7)
 * - build_muscle:  budget = tdee + surplus   (same formula, applied as surplus)
 * - maintain / eat_healthier: budget = tdee
 *
 * Applies a calorie floor to prevent dangerously low intake:
 *   male → 1500, female → 1200, other → 1350
 *
 * @param tdee          Total Daily Energy Expenditure in kcal
 * @param goal          User's fitness goal
 * @param rateKgPerWeek Target weight change rate in kg/week
 * @param sex           Biological sex (for calorie floor)
 * @returns { budget, deficit, floorApplied }
 */
export function computeCalorieBudget(
  tdee: number,
  goal: GoalType,
  rateKgPerWeek: number,
  sex: Sex,
): CalorieBudget {
  const KCAL_PER_KG = 7700;
  const deficitPerDay = (rateKgPerWeek * KCAL_PER_KG) / 7;

  let budget: number;
  switch (goal) {
    case 'lose_fat':
      budget = tdee - deficitPerDay;
      break;
    case 'build_muscle':
      budget = tdee + deficitPerDay;
      break;
    case 'maintain':
    case 'eat_healthier':
    default:
      budget = tdee;
      break;
  }

  const floors: Record<Sex, number> = { male: 1500, female: 1200, other: 1350 };
  const floor = floors[sex];
  let floorApplied = false;

  if (budget < floor) {
    budget = floor;
    floorApplied = true;
  }

  return {
    budget: Math.round(budget),
    deficit: Math.round(deficitPerDay),
    floorApplied,
  };
}

// ─── Function 7: computeMacroSplit ───────────────────────────────────────────

/**
 * Computes the macronutrient split (protein / carbs / fat) for a given calorie budget.
 *
 * Protein is set first from weight × protein_per_kg. Remaining calories are split
 * between carbs and fat based on diet style:
 *   balanced:     55% carbs / 45% fat
 *   high_protein: 50% carbs / 50% fat
 *   low_carb:     30% carbs / 70% fat
 *   keto:         10% carbs / 90% fat
 *
 * A fat floor of 0.6 g/kg body weight is enforced; carbs are reduced to compensate.
 *
 * @param budget       Daily calorie budget in kcal
 * @param weightKg     Body weight in kilograms
 * @param proteinPerKg Grams of protein per kg of body weight
 * @param dietStyle    Preferred macronutrient distribution style
 * @returns { proteinG, carbsG, fatG, proteinKcal, carbsKcal, fatKcal }
 */
export function computeMacroSplit(
  budget: number,
  weightKg: number,
  proteinPerKg: number,
  dietStyle: DietStyle,
): MacroSplit {
  const proteinG = Math.round(weightKg * proteinPerKg);
  const proteinKcal = proteinG * 4;
  const remaining = Math.max(0, budget - proteinKcal);

  const ratios: Record<DietStyle, { carb: number; fat: number }> = {
    balanced: { carb: 0.55, fat: 0.45 },
    high_protein: { carb: 0.50, fat: 0.50 },
    low_carb: { carb: 0.30, fat: 0.70 },
    keto: { carb: 0.10, fat: 0.90 },
  };

  const { carb: carbRatio, fat: fatRatio } = ratios[dietStyle];

  let carbsKcal = remaining * carbRatio;
  let fatKcal = remaining * fatRatio;
  let carbsG = Math.round(carbsKcal / 4);
  let fatG = Math.round(fatKcal / 9);

  // Enforce fat floor: minimum 0.6 g per kg body weight
  const minFat = Math.round(weightKg * 0.6);
  if (fatG < minFat) {
    const fatIncrease = minFat - fatG;
    fatG = minFat;
    fatKcal = fatG * 9;
    // Reduce carbs to compensate for the extra fat calories
    const carbsKcalReduction = fatIncrease * 9;
    carbsKcal = Math.max(0, carbsKcal - carbsKcalReduction);
    carbsG = Math.round(carbsKcal / 4);
  }

  return {
    proteinG,
    carbsG,
    fatG,
    proteinKcal,
    carbsKcal: Math.round(carbsKcal),
    fatKcal: Math.round(fatKcal),
  };
}

// ─── Function 8: estimateBodyFat ─────────────────────────────────────────────

/**
 * Estimates body fat percentage from BMI using sex-specific lookup tables.
 *
 * Male ranges:   BMI < 20 → 12%, 20-25 → 18%, 25-30 → 25%, > 30 → 32%
 * Female ranges: BMI < 20 → 20%, 20-25 → 26%, 25-30 → 33%, > 30 → 40%
 * Other:         average of male and female estimates
 *
 * Confidence interval: ±4 percentage points.
 *
 * @param weightKg Body weight in kilograms
 * @param heightCm Height in centimeters
 * @param sex      Biological sex
 * @returns { estimate, low, high } body fat percentages
 */
export function estimateBodyFat(
  weightKg: number,
  heightCm: number,
  sex: Sex,
): BodyFatEstimate {
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM ** 2);

  function lookup(s: 'male' | 'female'): number {
    if (s === 'male') {
      if (bmi < 20) return 12;
      if (bmi <= 25) return 18;
      if (bmi <= 30) return 25;
      return 32;
    }
    // female
    if (bmi < 20) return 20;
    if (bmi <= 25) return 26;
    if (bmi <= 30) return 33;
    return 40;
  }

  let estimate: number;
  if (sex === 'other') {
    estimate = (lookup('male') + lookup('female')) / 2;
  } else {
    estimate = lookup(sex);
  }

  return {
    estimate,
    low: estimate - 4,
    high: estimate + 4,
  };
}

// ─── Function 9: computeProjectedDate ────────────────────────────────────────

/**
 * Projects the date when a user will reach their target weight given a weekly rate.
 *
 * Returns null if rate is zero/negative or current weight already equals target.
 *
 * @param currentKg Current body weight in kilograms
 * @param targetKg  Target body weight in kilograms
 * @param rateKgPerWeek Weekly weight change rate in kg
 * @returns Projected Date object, or null if not applicable
 */
export function computeProjectedDate(
  currentKg: number,
  targetKg: number,
  rateKgPerWeek: number,
): Date | null {
  if (rateKgPerWeek <= 0 || currentKg === targetKg) return null;

  const weeks = Math.abs(currentKg - targetKg) / rateKgPerWeek;
  const days = Math.round(weeks * 7);
  return new Date(Date.now() + days * 86_400_000);
}

// ─── Function 10: getProteinRecommendation ───────────────────────────────────

/**
 * Returns a protein-per-kg recommendation based on the user's goal and whether
 * they perform strength training.
 *
 * Lookup table (g protein / kg body weight):
 *   lose_fat + strength:     { min: 2.0, max: 2.4, default: 2.2 }
 *   lose_fat + no strength:  { min: 1.6, max: 2.0, default: 1.8 }
 *   build_muscle + strength: { min: 1.8, max: 2.2, default: 2.0 }
 *   build_muscle + no str:   { min: 1.6, max: 2.0, default: 1.8 }
 *   maintain + strength:     { min: 1.6, max: 2.0, default: 1.8 }
 *   maintain + no strength:  { min: 1.4, max: 1.8, default: 1.6 }
 *   eat_healthier:           same as maintain
 *
 * @param goal           User's fitness goal
 * @param exerciseTypes  Array of exercise types the user performs
 * @returns { min, max, default } in g/kg
 */
export function getProteinRecommendation(
  goal: GoalType,
  exerciseTypes: ExerciseType[],
): ProteinRecommendation {
  const hasStrength = exerciseTypes.includes('strength');

  // eat_healthier uses the same table as maintain
  const effectiveGoal: GoalType = goal === 'eat_healthier' ? 'maintain' : goal;

  const table: Record<string, ProteinRecommendation> = {
    'lose_fat_strength':      { min: 2.0, max: 2.4, default: 2.2 },
    'lose_fat_no_strength':   { min: 1.6, max: 2.0, default: 1.8 },
    'build_muscle_strength':  { min: 1.8, max: 2.2, default: 2.0 },
    'build_muscle_no_strength': { min: 1.6, max: 2.0, default: 1.8 },
    'maintain_strength':      { min: 1.6, max: 2.0, default: 1.8 },
    'maintain_no_strength':   { min: 1.4, max: 1.8, default: 1.6 },
  };

  const key = `${effectiveGoal}_${hasStrength ? 'strength' : 'no_strength'}`;
  return table[key];
}

// ─── Function 11: computeLeanMass ────────────────────────────────────────────

export interface LeanMassEstimate {
  leanMassKg: number;
  fatMassKg: number;
  bodyFatPct: number;
  muscleMassKg: number; // estimated skeletal muscle (lean mass × 0.45 for males, 0.36 for females)
}

/**
 * Estimates lean mass, fat mass, and skeletal muscle mass from body metrics.
 *
 * When body fat % is provided, uses it directly.
 * When not provided, estimates body fat from BMI using the same lookup as estimateBodyFat.
 *
 * Skeletal muscle mass is estimated as a fraction of lean mass:
 *   Male: ~45% of lean mass is skeletal muscle
 *   Female: ~36% of lean mass is skeletal muscle
 *   Other: average of male and female
 *
 * @param weightKg   Body weight in kilograms
 * @param heightCm   Height in centimeters
 * @param sex        Biological sex
 * @param bodyFatPct Optional known body fat percentage
 * @returns { leanMassKg, fatMassKg, bodyFatPct, muscleMassKg }
 */
export function computeLeanMass(
  weightKg: number,
  heightCm: number,
  sex: Sex,
  bodyFatPct?: number,
): LeanMassEstimate {
  // Use provided body fat or estimate from BMI
  let bf: number;
  if (bodyFatPct !== undefined && bodyFatPct !== null) {
    bf = bodyFatPct;
  } else {
    bf = estimateBodyFat(weightKg, heightCm, sex).estimate;
  }

  const fatMassKg = Math.round(weightKg * (bf / 100) * 10) / 10;
  const leanMassKg = Math.round((weightKg - fatMassKg) * 10) / 10;

  // Skeletal muscle as fraction of lean mass
  const muscleRatio: Record<Sex, number> = { male: 0.45, female: 0.36, other: 0.405 };
  const muscleMassKg = Math.round(leanMassKg * muscleRatio[sex] * 10) / 10;

  return { leanMassKg, fatMassKg, bodyFatPct: bf, muscleMassKg };
}
