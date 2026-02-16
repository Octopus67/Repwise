export interface WarmUpSet {
  weightKg: number;
  reps: number;
  setType: 'warm-up';
}

const DEFAULT_BAR_WEIGHT_KG = 20;

export function generateWarmUpSets(
  workingWeightKg: number,
  barWeightKg: number = DEFAULT_BAR_WEIGHT_KG
): WarmUpSet[] {
  if (workingWeightKg <= barWeightKg) return [];

  const sets: WarmUpSet[] = [];

  // Bar only × 10
  sets.push({ weightKg: barWeightKg, reps: 10, setType: 'warm-up' });

  // 60% × 5 (only if meaningfully different from bar)
  const sixtyPct = Math.round(workingWeightKg * 0.6 / 2.5) * 2.5;
  if (sixtyPct > barWeightKg) {
    sets.push({ weightKg: sixtyPct, reps: 5, setType: 'warm-up' });
  }

  // 80% × 3 (only if meaningfully different from previous set)
  const eightyPct = Math.round(workingWeightKg * 0.8 / 2.5) * 2.5;
  const lastWeight = sets[sets.length - 1].weightKg;
  if (eightyPct > lastWeight) {
    sets.push({ weightKg: eightyPct, reps: 3, setType: 'warm-up' });
  }

  return sets;
}
