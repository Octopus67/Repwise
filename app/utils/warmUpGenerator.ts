export interface WarmUpSet {
  weightKg: number;
  reps: number;
  setType: 'warm-up';
}

const DEFAULT_BAR_WEIGHT_KG = 20;

export function generateWarmUpSets(
  workingWeightKg?: number,
  barWeightKgOrOptions?: number | { previousBestWeight?: number; barWeightKg?: number },
): WarmUpSet[] {
  let barWeight = DEFAULT_BAR_WEIGHT_KG;
  let effectiveWeight = workingWeightKg;

  if (typeof barWeightKgOrOptions === 'number') {
    barWeight = barWeightKgOrOptions;
  } else if (barWeightKgOrOptions) {
    if (barWeightKgOrOptions.barWeightKg != null) barWeight = barWeightKgOrOptions.barWeightKg;
    if (effectiveWeight == null && barWeightKgOrOptions.previousBestWeight != null) {
      effectiveWeight = barWeightKgOrOptions.previousBestWeight;
    }
  }

  if (effectiveWeight == null || effectiveWeight <= barWeight) return [];

  const sets: WarmUpSet[] = [];

  // Bar only × 10
  sets.push({ weightKg: barWeight, reps: 10, setType: 'warm-up' });

  // 60% × 5 (only if meaningfully different from bar)
  const sixtyPct = Math.round(effectiveWeight * 0.6 / 2.5) * 2.5;
  if (sixtyPct > barWeight) {
    sets.push({ weightKg: sixtyPct, reps: 5, setType: 'warm-up' });
  }

  // 80% × 3 (only if meaningfully different from previous set)
  const eightyPct = Math.round(effectiveWeight * 0.8 / 2.5) * 2.5;
  const lastWeight = sets[sets.length - 1].weightKg;
  if (eightyPct > lastWeight) {
    sets.push({ weightKg: eightyPct, reps: 3, setType: 'warm-up' });
  }

  return sets;
}
