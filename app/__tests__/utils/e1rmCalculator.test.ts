import { computeE1RM, bestE1RMForExercise } from '../../utils/e1rmCalculator';

describe('computeE1RM', () => {
  it('computes Epley formula for known values', () => {
    // 100kg × 5 reps = 100 × (1 + 5/30) = 116.67
    const result = computeE1RM(100, 5);
    expect(result).toBeCloseTo(116.667, 1);
  });

  it('returns weight when reps = 1', () => {
    expect(computeE1RM(100, 1)).toBe(100);
  });

  it('returns 0 when reps = 0', () => {
    expect(computeE1RM(100, 0)).toBe(0);
  });

  it('returns 0 when weight = 0', () => {
    expect(computeE1RM(0, 5)).toBe(0);
  });

  it('computes for high reps', () => {
    const result = computeE1RM(60, 15);
    // 60 × (1 + 15/30) = 60 × 1.5 = 90
    expect(result).toBeCloseTo(90, 1);
  });
});

describe('bestE1RMForExercise', () => {
  it('returns highest e1RM from multiple sets', () => {
    const sets = [
      { weight_kg: 100, reps: 5 },  // 116.67
      { weight_kg: 120, reps: 1 },  // 120
      { weight_kg: 80, reps: 10 },  // 106.67
    ];
    const result = bestE1RMForExercise(sets);
    expect(result).toBeCloseTo(120, 1);
  });

  it('returns null for empty sets', () => {
    expect(bestE1RMForExercise([])).toBeNull();
  });

  it('returns null when all sets are invalid', () => {
    const sets = [
      { weight_kg: 0, reps: 5 },
      { weight_kg: 50, reps: 0 },
    ];
    expect(bestE1RMForExercise(sets)).toBeNull();
  });

  it('skips invalid sets and picks best from valid ones', () => {
    const sets = [
      { weight_kg: 0, reps: 5 },
      { weight_kg: 100, reps: 3 },  // 110
    ];
    const result = bestE1RMForExercise(sets);
    expect(result).toBeCloseTo(110, 1);
  });
});
