import {
  computeBMR,
  computeNEAT,
  computeEAT,
  computeTEF,
  computeTDEEBreakdown,
  computeCalorieBudget,
  computeMacroSplit,
  estimateBodyFat,
  computeProjectedDate,
  getProteinRecommendation,
} from '../../utils/onboardingCalculations';

// ─── computeBMR ──────────────────────────────────────────────────────────────

describe('computeBMR', () => {
  test('male 80kg, 180cm, 25yo → Mifflin-St Jeor ≈ 1780', () => {
    // 10*80 + 6.25*180 - 5*25 + 5 = 800 + 1125 - 125 + 5 = 1805
    const result = computeBMR(80, 180, 25, 'male');
    expect(result).toBeCloseTo(1805, 0);
  });

  test('female 60kg, 165cm, 30yo → Mifflin-St Jeor ≈ 1301', () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25
    const result = computeBMR(60, 165, 30, 'female');
    expect(result).toBeCloseTo(1320, 0);
  });

  test('sex "other" → average of male and female results', () => {
    const male = computeBMR(70, 175, 28, 'male');
    const female = computeBMR(70, 175, 28, 'female');
    const other = computeBMR(70, 175, 28, 'other');
    expect(other).toBeCloseTo(Math.round((male + female) / 2), 0);
  });

  test('with body fat 15%, 80kg → Katch-McArdle ≈ 1839', () => {
    // lean_mass = 80 * (1 - 0.15) = 68
    // BMR = 370 + 21.6 * 68 = 370 + 1468.8 = 1838.8 → 1839
    const result = computeBMR(80, 180, 25, 'male', 15);
    expect(result).toBeCloseTo(1839, 0);
  });

  test('edge: weight 0 → returns 0', () => {
    expect(computeBMR(0, 180, 25, 'male')).toBe(0);
  });

  test('edge: age 13 (minimum) → valid result > 0', () => {
    const result = computeBMR(50, 160, 13, 'male');
    expect(result).toBeGreaterThan(0);
  });

  test('edge: age 120 → valid result > 0', () => {
    const result = computeBMR(70, 170, 120, 'male');
    expect(result).toBeGreaterThan(0);
  });

  test('edge: height 0 → returns 0', () => {
    expect(computeBMR(80, 0, 25, 'male')).toBe(0);
  });
});

// ─── computeNEAT ─────────────────────────────────────────────────────────────

describe('computeNEAT', () => {
  test('BMR 1780, sedentary → 2.5 × 70 = 175', () => {
    expect(computeNEAT(1780, 'sedentary')).toBeCloseTo(175, 0);
  });

  test('BMR 1780, lightly_active → 5.0 × 70 = 350', () => {
    expect(computeNEAT(1780, 'lightly_active')).toBeCloseTo(350, 0);
  });

  test('BMR 1780, moderately_active → 7.5 × 70 = 525', () => {
    expect(computeNEAT(1780, 'moderately_active')).toBeCloseTo(525, 0);
  });

  test('BMR 1780, highly_active → 11.0 × 70 = 770', () => {
    expect(computeNEAT(1780, 'highly_active')).toBeCloseTo(770, 0);
  });
});

// ─── computeEAT ──────────────────────────────────────────────────────────────

describe('computeEAT', () => {
  test('80kg, 4 sessions, strength → ~153/day', () => {
    // burn per session = 80*5.0*0.67 = 268
    // weekly = 4 * 268 = 1072
    // daily = round(1072/7) = 153
    const result = computeEAT(80, 4, ['strength']);
    expect(result).toBeCloseTo(153, 0);
  });

  test('80kg, 0 sessions → 0', () => {
    expect(computeEAT(80, 0, ['strength'])).toBe(0);
  });

  test('80kg, 3 sessions, cardio → ~183/day', () => {
    // burn per session = 80*8.0*0.67 = 428.8 → 428
    // weekly = 3 * 428.8 = 1286.4
    // daily = round(1286.4/7) = 184
    const result = computeEAT(80, 3, ['cardio']);
    expect(result).toBeCloseTo(184, 0);
  });

  test('80kg, 5 sessions, strength+cardio → average of both burns', () => {
    // strength burn = 80*5.0*0.67 = 268
    // cardio burn = 80*8.0*0.67 = 428.8
    // avg = (268+428.8)/2 = 348.4
    // weekly = 5 * 348.4 = 1742
    // daily = round(1742/7) = 249
    const result = computeEAT(80, 5, ['strength', 'cardio']);
    expect(result).toBeCloseTo(249, 0);
  });
});

// ─── computeTEF ──────────────────────────────────────────────────────────────

describe('computeTEF', () => {
  test('BMR 1780, NEAT 979, EAT 171 → (1780+979+171)*0.10 ≈ 293', () => {
    const result = computeTEF(1780, 979, 171);
    expect(result).toBeCloseTo(293, 0);
  });

  test('all zeros → 0', () => {
    expect(computeTEF(0, 0, 0)).toBe(0);
  });
});

// ─── computeTDEEBreakdown ────────────────────────────────────────────────────

describe('computeTDEEBreakdown', () => {
  test('full calculation: male 80kg, 180cm, 25yo, moderately_active, 4 strength sessions', () => {
    const result = computeTDEEBreakdown(80, 180, 25, 'male', 'moderately_active', 4, ['strength']);

    // Verify components sum to total
    expect(result.bmr + result.neat + result.eat + result.tef).toBeCloseTo(result.total, 0);

    // Verify total is in reasonable range
    expect(result.total).toBeGreaterThan(2000);
    expect(result.total).toBeLessThan(3500);

    // Verify individual components are positive
    expect(result.bmr).toBeGreaterThan(0);
    expect(result.neat).toBeGreaterThan(0);
    expect(result.eat).toBeGreaterThan(0);
    expect(result.tef).toBeGreaterThan(0);
  });

  test('total > bmr always (property)', () => {
    const result = computeTDEEBreakdown(70, 170, 30, 'female', 'sedentary', 2, ['yoga']);
    expect(result.total).toBeGreaterThan(result.bmr);
  });

  test('edge: all minimum values', () => {
    const result = computeTDEEBreakdown(40, 100, 13, 'female', 'sedentary', 0, []);
    expect(result.total).toBeGreaterThan(0);
    expect(result.bmr + result.neat + result.eat + result.tef).toBeCloseTo(result.total, 0);
  });
});

// ─── computeCalorieBudget ────────────────────────────────────────────────────

describe('computeCalorieBudget', () => {
  test('TDEE 2500, lose_fat, 0.5 kg/week → deficit 550, budget 1950', () => {
    // 0.5 kg/week * 1100 kcal/kg = 550 deficit
    const result = computeCalorieBudget(2500, 'lose_fat', 0.5, 'male');
    expect(result.budget).toBeCloseTo(1950, 0);
    expect(result.deficit).toBeCloseTo(550, 0);
    expect(result.floorApplied).toBe(false);
  });

  test('TDEE 2500, build_muscle, 0.25 kg/week → surplus 275, budget 2775', () => {
    // 0.25 kg/week * 7700 / 7 = 275 surplus per day
    const result = computeCalorieBudget(2500, 'build_muscle', 0.25, 'male');
    expect(result.budget).toBeCloseTo(2775, 0);
    expect(result.deficit).toBeCloseTo(275, 0);
  });

  test('TDEE 2500, maintain → budget 2500, deficit 0', () => {
    const result = computeCalorieBudget(2500, 'maintain', 0, 'male');
    expect(result.budget).toBeCloseTo(2500, 0);
    expect(result.deficit).toBeCloseTo(0, 0);
  });

  test('calorie floor: TDEE 1800, lose_fat, 1.0 kg/week, female → floored to 1200', () => {
    // 1.0 * 1100 = 1100 deficit → raw budget = 700 → floored to 1200
    const result = computeCalorieBudget(1800, 'lose_fat', 1.0, 'female');
    expect(result.budget).toBeCloseTo(1200, 0);
    expect(result.floorApplied).toBe(true);
  });

  test('calorie floor: TDEE 2500, lose_fat, 0.5 kg/week, male → no floor applied', () => {
    const result = computeCalorieBudget(2500, 'lose_fat', 0.5, 'male');
    expect(result.budget).toBeCloseTo(1950, 0);
    expect(result.floorApplied).toBe(false);
  });

  test('eat_healthier → same as maintain', () => {
    const maintain = computeCalorieBudget(2500, 'maintain', 0, 'male');
    const eatHealthier = computeCalorieBudget(2500, 'eat_healthier', 0, 'male');
    expect(eatHealthier.budget).toBeCloseTo(maintain.budget, 0);
    expect(eatHealthier.deficit).toBeCloseTo(maintain.deficit, 0);
  });
});

// ─── computeMacroSplit ───────────────────────────────────────────────────────

describe('computeMacroSplit', () => {
  test('budget 2000, 80kg, 2.0 g/kg, balanced → correct macro distribution', () => {
    // protein = 80 * 2.0 = 160g → 640 kcal
    // remaining = 2000 - 640 = 1360
    // carbs = 1360 * 0.55 / 4 ≈ 187g
    // fat = 1360 * 0.45 / 9 ≈ 68g
    const result = computeMacroSplit(2000, 80, 2.0, 'balanced');
    expect(result.proteinG).toBeCloseTo(160, 0);
    expect(result.carbsG).toBeCloseTo(187, 0);
    expect(result.fatG).toBeCloseTo(68, 0);
  });

  test('budget 2000, 80kg, 2.0 g/kg, keto → carbs very low, fat very high', () => {
    const result = computeMacroSplit(2000, 80, 2.0, 'keto');
    expect(result.proteinG).toBeCloseTo(160, 0);
    // Keto: very low carbs, high fat
    expect(result.carbsG).toBeLessThan(50);
    expect(result.fatG).toBeGreaterThan(100);
  });

  test('fat floor enforcement: budget 1500, 80kg, 2.5 g/kg → fat raised to floor', () => {
    // protein = 80 * 2.5 = 200g → 800 kcal
    // remaining = 1500 - 800 = 700
    // balanced fat = 700 * 0.45 / 9 ≈ 35g
    // fat floor = 80 * 0.6 = 48g → fat raised to 48g, carbs reduced
    const result = computeMacroSplit(1500, 80, 2.5, 'balanced');
    expect(result.fatG).toBeGreaterThanOrEqual(48);
  });

  test('protein_kcal + carbs_kcal + fat_kcal ≈ budget (within ±10 kcal)', () => {
    const budget = 2000;
    const result = computeMacroSplit(budget, 80, 2.0, 'balanced');
    const totalKcal = result.proteinKcal + result.carbsKcal + result.fatKcal;
    expect(totalKcal).toBeGreaterThan(budget - 10);
    expect(totalKcal).toBeLessThan(budget + 10);
  });

  test('kcal values match gram values', () => {
    const result = computeMacroSplit(2500, 75, 1.8, 'balanced');
    expect(result.proteinKcal).toBeCloseTo(result.proteinG * 4, 0);
    // carbsKcal and fatKcal may differ slightly from g*4 and g*9 due to rounding
    expect(Math.abs(result.carbsKcal - result.carbsG * 4)).toBeLessThan(10);
    expect(Math.abs(result.fatKcal - result.fatG * 9)).toBeLessThan(10);
  });

  test('high_protein diet style → higher protein ratio in remaining', () => {
    const balanced = computeMacroSplit(2500, 80, 2.0, 'balanced');
    const highProt = computeMacroSplit(2500, 80, 2.0, 'high_protein');
    // high_protein should have same protein (set by g/kg) but different carb/fat ratio
    expect(highProt.proteinG).toBeCloseTo(balanced.proteinG, 0);
  });
});

// ─── estimateBodyFat ─────────────────────────────────────────────────────────

describe('estimateBodyFat', () => {
  test('male, 80kg, 180cm → BMI ~24.7, estimate ~18%, range 14-22', () => {
    const result = estimateBodyFat(80, 180, 'male');
    expect(result.estimate).toBeCloseTo(18, 0);
    expect(result.low).toBeCloseTo(14, 0);
    expect(result.high).toBeCloseTo(22, 0);
  });

  test('female, 60kg, 165cm → BMI ~22.0, estimate ~26%, range 22-30', () => {
    const result = estimateBodyFat(60, 165, 'female');
    expect(result.estimate).toBeCloseTo(26, 0);
    expect(result.low).toBeCloseTo(22, 0);
    expect(result.high).toBeCloseTo(30, 0);
  });

  test('male, 100kg, 175cm → BMI ~32.7, estimate ~32%, range 28-36', () => {
    const result = estimateBodyFat(100, 175, 'male');
    expect(result.estimate).toBeCloseTo(32, 0);
    expect(result.low).toBeCloseTo(28, 0);
    expect(result.high).toBeCloseTo(36, 0);
  });

  test('other → average of male and female estimates', () => {
    const male = estimateBodyFat(80, 180, 'male');
    const female = estimateBodyFat(80, 180, 'female');
    const other = estimateBodyFat(80, 180, 'other');
    expect(other.estimate).toBeCloseTo((male.estimate + female.estimate) / 2, 0);
  });
});

// ─── computeProjectedDate ────────────────────────────────────────────────────

describe('computeProjectedDate', () => {
  test('80kg → 75kg at 0.5 kg/week → ~70 days from now', () => {
    const result = computeProjectedDate(80, 75, 0.5);
    expect(result).not.toBeNull();
    if (result) {
      const now = new Date();
      const diffMs = result.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      // 5kg / 0.5 kg/week = 10 weeks = 70 days
      expect(diffDays).toBeGreaterThan(65);
      expect(diffDays).toBeLessThan(75);
    }
  });

  test('rate 0 → null', () => {
    expect(computeProjectedDate(80, 75, 0)).toBeNull();
  });

  test('current equals target → null', () => {
    expect(computeProjectedDate(75, 75, 0.5)).toBeNull();
  });
});

// ─── getProteinRecommendation ────────────────────────────────────────────────

describe('getProteinRecommendation', () => {
  test('lose_fat + strength → { min: 2.0, max: 2.4, default: 2.2 }', () => {
    const result = getProteinRecommendation('lose_fat', ['strength']);
    expect(result.min).toBeCloseTo(2.0, 1);
    expect(result.max).toBeCloseTo(2.4, 1);
    expect(result.default).toBeCloseTo(2.2, 1);
  });

  test('build_muscle + no strength → { min: 1.6, max: 2.0, default: 1.8 }', () => {
    const result = getProteinRecommendation('build_muscle', ['cardio']);
    expect(result.min).toBeCloseTo(1.6, 1);
    expect(result.max).toBeCloseTo(2.0, 1);
    expect(result.default).toBeCloseTo(1.8, 1);
  });

  test('maintain + strength → { min: 1.6, max: 2.0, default: 1.8 }', () => {
    const result = getProteinRecommendation('maintain', ['strength', 'cardio']);
    expect(result.min).toBeCloseTo(1.6, 1);
    expect(result.max).toBeCloseTo(2.0, 1);
    expect(result.default).toBeCloseTo(1.8, 1);
  });

  test('eat_healthier + no strength → same as maintain + no strength', () => {
    const maintain = getProteinRecommendation('maintain', ['yoga']);
    const eatHealthier = getProteinRecommendation('eat_healthier', ['yoga']);
    expect(eatHealthier.min).toBeCloseTo(maintain.min, 1);
    expect(eatHealthier.max).toBeCloseTo(maintain.max, 1);
    expect(eatHealthier.default).toBeCloseTo(maintain.default, 1);
  });
});

// ─── Additional Edge Cases ───────────────────────────────────────────────────

describe('computeBMR edge cases', () => {
  test('body fat 0% → lean mass equals weight', () => {
    // lean_mass = 80 * (1 - 0) = 80, BMR = 370 + 21.6*80 = 2098
    expect(computeBMR(80, 180, 25, 'male', 0)).toBeCloseTo(2098, 0);
  });

  test('negative weight → returns 0', () => {
    expect(computeBMR(-10, 180, 25, 'male')).toBe(0);
  });

  test('negative age → returns 0', () => {
    expect(computeBMR(80, 180, -5, 'male')).toBe(0);
  });
});

describe('computeEAT edge cases', () => {
  test('empty exerciseTypes array → falls back to strength', () => {
    const withStrength = computeEAT(80, 4, ['strength']);
    const withEmpty = computeEAT(80, 4, []);
    expect(withEmpty).toBe(withStrength);
  });

  test('sports type → correct burn (80kg * 6.0 * 0.75 = 360 per session)', () => {
    // 3 sessions * 360 / 7 ≈ 154
    expect(computeEAT(80, 3, ['sports'])).toBeCloseTo(154, 0);
  });

  test('yoga type → correct burn (80kg * 3.0 * 0.67 = 160.8 per session)', () => {
    // 3 sessions * 160.8 / 7 ≈ 69
    expect(computeEAT(80, 3, ['yoga'])).toBeCloseTo(69, 0);
  });

  test('walking type → correct burn (80kg * 3.5 * 0.75 = 210 per session)', () => {
    // 3 sessions * 210 / 7 = 90
    expect(computeEAT(80, 3, ['walking'])).toBeCloseTo(90, 0);
  });

  test('all 5 exercise types combined → correct average', () => {
    // strength: 268, cardio: 428.8, sports: 360, yoga: 160.8, walking: 210
    // avg = (268+428.8+360+160.8+210)/5 = 285.52
    // 3 sessions * 285.52 / 7 ≈ 122
    expect(computeEAT(80, 3, ['strength', 'cardio', 'sports', 'yoga', 'walking'])).toBeCloseTo(122, 0);
  });
});

describe('computeNEAT edge cases', () => {
  test('BMR 0 → NEAT still weight-based (default 70kg)', () => {
    // NEAT is now weight-based, not BMR-based, so BMR=0 doesn't mean NEAT=0
    expect(computeNEAT(0, 'sedentary')).toBe(175);       // 2.5 × 70
    expect(computeNEAT(0, 'highly_active')).toBe(770);   // 11.0 × 70
  });
});

describe('computeCalorieBudget edge cases', () => {
  test('calorie floor for sex=other → floored to 1350', () => {
    const result = computeCalorieBudget(1800, 'lose_fat', 1.0, 'other');
    expect(result.budget).toBe(1350);
    expect(result.floorApplied).toBe(true);
  });

  test('calorie floor for male → floored to 1500', () => {
    const result = computeCalorieBudget(1800, 'lose_fat', 1.5, 'male');
    expect(result.budget).toBe(1500);
    expect(result.floorApplied).toBe(true);
  });

  test('rateKgPerWeek = 0 with lose_fat → same as maintain', () => {
    const loseFat = computeCalorieBudget(2500, 'lose_fat', 0, 'male');
    const maintain = computeCalorieBudget(2500, 'maintain', 0, 'male');
    expect(loseFat.budget).toBe(maintain.budget);
  });
});

describe('computeMacroSplit edge cases', () => {
  test('low_carb diet style → 30% carbs / 70% fat split', () => {
    const result = computeMacroSplit(2500, 80, 2.0, 'low_carb');
    // protein = 160g → 640 kcal, remaining = 1860
    // carbs = 1860 * 0.30 / 4 ≈ 140g
    // fat = 1860 * 0.70 / 9 ≈ 145g
    expect(result.carbsG).toBeLessThan(result.fatG);
    expect(result.proteinG).toBe(160);
  });

  test('budget 0 → protein from weight, carbs and fat 0 or at floor', () => {
    const result = computeMacroSplit(0, 80, 2.0, 'balanced');
    // protein = 160g → 640 kcal, remaining = max(0, 0-640) = 0
    expect(result.proteinG).toBe(160);
    // remaining is 0, but fat floor may apply
    expect(result.fatG).toBeGreaterThanOrEqual(Math.round(80 * 0.6));
  });

  test('proteinKcal exceeds budget → remaining is 0, fat at floor', () => {
    // 80kg * 3.0 g/kg = 240g protein → 960 kcal, budget 800
    const result = computeMacroSplit(800, 80, 3.0, 'balanced');
    expect(result.proteinG).toBe(240);
    expect(result.fatG).toBeGreaterThanOrEqual(Math.round(80 * 0.6));
  });
});

describe('estimateBodyFat boundary values', () => {
  test('BMI just above 20 boundary for male → 18% (20-25 bucket)', () => {
    // BMI = 20.01 → weight = 20.01 * (1.80)^2 ≈ 64.83
    const result = estimateBodyFat(64.83, 180, 'male');
    expect(result.estimate).toBe(18);
  });

  test('BMI exactly 25 boundary for male → 18% (20-25 bucket)', () => {
    // BMI = 25 → weight = 25 * (1.80)^2 = 81
    const result = estimateBodyFat(81, 180, 'male');
    expect(result.estimate).toBe(18);
  });

  test('BMI exactly 30 boundary for male → 25% (25-30 bucket)', () => {
    // BMI = 30 → weight = 30 * (1.80)^2 = 97.2
    const result = estimateBodyFat(97.2, 180, 'male');
    expect(result.estimate).toBe(25);
  });

  test('very underweight BMI < 15 → lowest bucket', () => {
    const result = estimateBodyFat(40, 180, 'male');
    expect(result.estimate).toBe(12);
  });

  test('extremely obese BMI > 50 → highest bucket', () => {
    const result = estimateBodyFat(180, 180, 'male');
    expect(result.estimate).toBe(32);
  });
});

describe('computeProjectedDate edge cases', () => {
  test('gaining weight: 70kg → 80kg at 0.25 kg/week → ~280 days', () => {
    const result = computeProjectedDate(70, 80, 0.25);
    expect(result).not.toBeNull();
    if (result) {
      const diffDays = (result.getTime() - Date.now()) / 86_400_000;
      expect(diffDays).toBeGreaterThan(275);
      expect(diffDays).toBeLessThan(285);
    }
  });

  test('negative rateKgPerWeek → returns null', () => {
    expect(computeProjectedDate(80, 75, -0.5)).toBeNull();
  });
});

describe('getProteinRecommendation missing combos', () => {
  test('build_muscle + strength → { min: 1.8, max: 2.2, default: 2.0 }', () => {
    const result = getProteinRecommendation('build_muscle', ['strength']);
    expect(result.min).toBeCloseTo(1.8, 1);
    expect(result.max).toBeCloseTo(2.2, 1);
    expect(result.default).toBeCloseTo(2.0, 1);
  });

  test('lose_fat + no strength → { min: 1.6, max: 2.0, default: 1.8 }', () => {
    const result = getProteinRecommendation('lose_fat', ['cardio']);
    expect(result.min).toBeCloseTo(1.6, 1);
    expect(result.max).toBeCloseTo(2.0, 1);
    expect(result.default).toBeCloseTo(1.8, 1);
  });

  test('maintain + no strength → { min: 1.4, max: 1.8, default: 1.6 }', () => {
    const result = getProteinRecommendation('maintain', ['yoga']);
    expect(result.min).toBeCloseTo(1.4, 1);
    expect(result.max).toBeCloseTo(1.8, 1);
    expect(result.default).toBeCloseTo(1.6, 1);
  });

  test('empty exerciseTypes → treated as no strength', () => {
    const withEmpty = getProteinRecommendation('lose_fat', []);
    const withNoStrength = getProteinRecommendation('lose_fat', ['cardio']);
    expect(withEmpty.min).toBe(withNoStrength.min);
    expect(withEmpty.max).toBe(withNoStrength.max);
    expect(withEmpty.default).toBe(withNoStrength.default);
  });
});
