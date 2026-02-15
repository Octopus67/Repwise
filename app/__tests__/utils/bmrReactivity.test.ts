import {
  computeBMR,
  computeLeanMass,
  estimateBodyFat,
} from '../../utils/onboardingCalculations';

describe('BMR reactivity — regression tests', () => {
  // These tests ensure BMR changes when inputs change.
  // Regression for: scroll scale not updating store → BMR appeared frozen.

  test('BMR increases when height increases (same weight/age/sex)', () => {
    const bmr160 = computeBMR(70, 160, 25, 'male');
    const bmr170 = computeBMR(70, 170, 25, 'male');
    const bmr180 = computeBMR(70, 180, 25, 'male');
    const bmr190 = computeBMR(70, 190, 25, 'male');

    expect(bmr170).toBeGreaterThan(bmr160);
    expect(bmr180).toBeGreaterThan(bmr170);
    expect(bmr190).toBeGreaterThan(bmr180);

    // Each 10cm should add ~62-63 kcal (6.25 * 10, rounding varies)
    expect(bmr170 - bmr160).toBeGreaterThanOrEqual(62);
    expect(bmr170 - bmr160).toBeLessThanOrEqual(63);
    expect(bmr180 - bmr170).toBeGreaterThanOrEqual(62);
    expect(bmr180 - bmr170).toBeLessThanOrEqual(63);
  });

  test('BMR increases when weight increases (same height/age/sex)', () => {
    const bmr60 = computeBMR(60, 175, 25, 'male');
    const bmr70 = computeBMR(70, 175, 25, 'male');
    const bmr80 = computeBMR(80, 175, 25, 'male');
    const bmr90 = computeBMR(90, 175, 25, 'male');

    expect(bmr70).toBeGreaterThan(bmr60);
    expect(bmr80).toBeGreaterThan(bmr70);
    expect(bmr90).toBeGreaterThan(bmr80);

    // Each 10kg should add ~100 kcal (10 * 10)
    expect(bmr70 - bmr60).toBeCloseTo(100, 0);
  });

  test('BMR decreases when age increases (same height/weight/sex)', () => {
    const bmr20 = computeBMR(80, 180, 20, 'male');
    const bmr30 = computeBMR(80, 180, 30, 'male');
    const bmr40 = computeBMR(80, 180, 40, 'male');

    expect(bmr30).toBeLessThan(bmr20);
    expect(bmr40).toBeLessThan(bmr30);

    // Each 10 years should reduce by ~50 kcal (5 * 10)
    expect(bmr20 - bmr30).toBeCloseTo(50, 0);
  });

  test('BMR is higher for males than females (same metrics)', () => {
    const male = computeBMR(70, 175, 25, 'male');
    const female = computeBMR(70, 175, 25, 'female');
    expect(male).toBeGreaterThan(female);
    // Difference should be ~166 kcal (5 + 161)
    expect(male - female).toBeCloseTo(166, 0);
  });

  test('BMR with body fat uses Katch-McArdle (ignores height)', () => {
    // Katch-McArdle: BMR = 370 + 21.6 * leanMass
    // Same weight and body fat but different heights → same BMR
    const bmr_short = computeBMR(80, 160, 25, 'male', 20);
    const bmr_tall = computeBMR(80, 190, 25, 'male', 20);
    expect(bmr_short).toBe(bmr_tall); // Katch-McArdle doesn't use height
  });

  test('BMR without body fat uses Mifflin-St Jeor (uses height)', () => {
    const bmr_short = computeBMR(80, 160, 25, 'male');
    const bmr_tall = computeBMR(80, 190, 25, 'male');
    expect(bmr_tall).toBeGreaterThan(bmr_short); // Mifflin uses height
  });

  test('lower body fat → higher BMR (more lean mass)', () => {
    const bmr_10pct = computeBMR(80, 180, 25, 'male', 10);
    const bmr_20pct = computeBMR(80, 180, 25, 'male', 20);
    const bmr_30pct = computeBMR(80, 180, 25, 'male', 30);

    expect(bmr_10pct).toBeGreaterThan(bmr_20pct);
    expect(bmr_20pct).toBeGreaterThan(bmr_30pct);
  });
});

describe('computeLeanMass', () => {
  test('with known body fat: 80kg at 20% → 64kg lean, 16kg fat', () => {
    const result = computeLeanMass(80, 180, 'male', 20);
    expect(result.leanMassKg).toBeCloseTo(64, 0);
    expect(result.fatMassKg).toBeCloseTo(16, 0);
    expect(result.bodyFatPct).toBe(20);
  });

  test('without body fat: uses BMI-based estimate', () => {
    const result = computeLeanMass(80, 180, 'male');
    // BMI ~24.7 → estimated BF ~18% → lean ~65.6kg, fat ~14.4kg
    expect(result.bodyFatPct).toBe(18); // from estimateBodyFat
    expect(result.leanMassKg).toBeGreaterThan(60);
    expect(result.fatMassKg).toBeGreaterThan(10);
  });

  test('muscle mass is ~45% of lean mass for males', () => {
    const result = computeLeanMass(80, 180, 'male', 15);
    // lean = 80 * 0.85 = 68kg, muscle = 68 * 0.45 = 30.6kg
    expect(result.muscleMassKg).toBeCloseTo(30.6, 0);
  });

  test('muscle mass is ~36% of lean mass for females', () => {
    const result = computeLeanMass(60, 165, 'female', 25);
    // lean = 60 * 0.75 = 45kg, muscle = 45 * 0.36 = 16.2kg
    expect(result.muscleMassKg).toBeCloseTo(16.2, 0);
  });

  test('heavier person at same BF% has more muscle mass', () => {
    const light = computeLeanMass(70, 175, 'male', 15);
    const heavy = computeLeanMass(90, 175, 'male', 15);
    expect(heavy.muscleMassKg).toBeGreaterThan(light.muscleMassKg);
    expect(heavy.leanMassKg).toBeGreaterThan(light.leanMassKg);
  });

  test('lean + fat = total weight', () => {
    const result = computeLeanMass(80, 180, 'male', 20);
    expect(result.leanMassKg + result.fatMassKg).toBeCloseTo(80, 0);
  });

  test('very lean person (5% BF) has high lean mass ratio', () => {
    const result = computeLeanMass(75, 178, 'male', 5);
    expect(result.leanMassKg).toBeCloseTo(71.2, 0);
    expect(result.fatMassKg).toBeCloseTo(3.8, 0);
  });
});

describe('BMR muscle mass awareness', () => {
  // These tests verify that the algorithm produces different BMR values
  // for people with different body compositions at the same total weight.

  test('muscular person (low BF%) has higher BMR than average person at same weight', () => {
    // Both 80kg, but one is 12% BF (muscular) and one is 25% BF (average)
    const muscular = computeBMR(80, 180, 25, 'male', 12);
    const average = computeBMR(80, 180, 25, 'male', 25);
    expect(muscular).toBeGreaterThan(average);
    // Difference should be meaningful (>100 kcal)
    expect(muscular - average).toBeGreaterThan(100);
  });

  test('Katch-McArdle gives higher BMR for lean individuals vs Mifflin', () => {
    // Very lean 80kg male at 10% BF
    const katchMcArdle = computeBMR(80, 180, 25, 'male', 10);
    const mifflin = computeBMR(80, 180, 25, 'male'); // no BF → Mifflin
    // Katch-McArdle should be higher for lean individuals
    expect(katchMcArdle).toBeGreaterThan(mifflin);
  });

  test('Katch-McArdle gives lower BMR for high-BF individuals vs Mifflin', () => {
    // Overweight 80kg male at 30% BF
    const katchMcArdle = computeBMR(80, 180, 25, 'male', 30);
    const mifflin = computeBMR(80, 180, 25, 'male');
    // Katch-McArdle should be lower for high-BF individuals
    expect(katchMcArdle).toBeLessThan(mifflin);
  });
});
