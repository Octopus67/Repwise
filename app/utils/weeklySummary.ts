/**
 * Weekly nutrition summary computation.
 *
 * Pure function — no React Native imports.
 */

export interface NutritionEntry {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  entry_date: string;
  micro_nutrients?: Record<string, number> | null;
}

export interface WeeklySummary {
  avgCalories: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  totalWaterMl: number;
  bestDay: { date: string; deviation: number } | null;
  worstDay: { date: string; deviation: number } | null;
  daysLogged: number;
}

/**
 * Compute a 7-day nutrition summary from entries.
 *
 * Averages are computed from days WITH data only (not divided by 7).
 * Best/worst adherence days are based on absolute deviation from targetCalories.
 */
export function computeWeeklySummary(
  entries: NutritionEntry[],
  targetCalories: number,
): WeeklySummary {
  if (targetCalories < 0) targetCalories = 0;

  // Group entries by date
  const byDate = new Map<string, NutritionEntry[]>();
  for (const e of entries) {
    const existing = byDate.get(e.entry_date) || [];
    existing.push(e);
    byDate.set(e.entry_date, existing);
  }

  const daysLogged = byDate.size;

  if (daysLogged === 0) {
    return {
      avgCalories: 0,
      avgProtein: 0,
      avgCarbs: 0,
      avgFat: 0,
      totalWaterMl: 0,
      bestDay: null,
      worstDay: null,
      daysLogged: 0,
    };
  }

  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalWaterMl = 0;

  let bestDay: { date: string; deviation: number } | null = null;
  let worstDay: { date: string; deviation: number } | null = null;

  for (const [date, dayEntries] of byDate) {
    let dayCalories = 0;
    let dayProtein = 0;
    let dayCarbs = 0;
    let dayFat = 0;

    for (const e of dayEntries) {
      const safeCal = Number.isFinite(e.calories) ? e.calories : 0;
      const safePro = Number.isFinite(e.protein_g) ? e.protein_g : 0;
      const safeCar = Number.isFinite(e.carbs_g) ? e.carbs_g : 0;
      const safeFat = Number.isFinite(e.fat_g) ? e.fat_g : 0;
      dayCalories += safeCal;
      dayProtein += safePro;
      dayCarbs += safeCar;
      dayFat += safeFat;

      if (e.micro_nutrients && typeof e.micro_nutrients.water_ml === 'number') {
        totalWaterMl += e.micro_nutrients.water_ml;
      }
    }

    totalCalories += dayCalories;
    totalProtein += dayProtein;
    totalCarbs += dayCarbs;
    totalFat += dayFat;

    const deviation = Math.abs(dayCalories - targetCalories);

    if (bestDay === null || deviation < bestDay.deviation) {
      bestDay = { date, deviation };
    }
    if (worstDay === null || deviation > worstDay.deviation) {
      worstDay = { date, deviation };
    }
  }

  if (targetCalories <= 0) {
    bestDay = null;
    worstDay = null;
  }

  return {
    avgCalories: totalCalories / daysLogged,
    avgProtein: totalProtein / daysLogged,
    avgCarbs: totalCarbs / daysLogged,
    avgFat: totalFat / daysLogged,
    totalWaterMl,
    bestDay,
    worstDay,
    daysLogged,
  };
}
