/**
 * TDEE estimation from weight history and calorie data.
 *
 * Uses EMA smoothing with constants matching the backend adaptive engine:
 *   EMA_ALPHA = 0.25 (2 / (EMA_WINDOW + 1))
 *   EMA_WINDOW = 7
 *
 * Formula: TDEE = avgDailyCalories + (weightChangeKg * 7700 / windowDays)
 *
 * Pure function — no React Native imports.
 */

export interface WeightPoint {
  date: string;
  weight_kg: number;
}

export interface TDEEEstimate {
  tdee: number;
  windowDays: number;
  avgDailyCalories: number;
  weightChangeKg: number;
}

const EMA_ALPHA = 0.25;
const KCAL_PER_KG = 7700;
const MIN_DATA_DAYS = 14;

/**
 * Compute EMA over a sorted array of weight values.
 */
function computeEMA(weights: number[]): number {
  if (weights.length === 0) return 0;
  let ema = weights[0];
  for (let i = 1; i < weights.length; i++) {
    ema = EMA_ALPHA * weights[i] + (1 - EMA_ALPHA) * ema;
  }
  return ema;
}

/**
 * Estimate TDEE from weight history and daily calorie totals.
 *
 * Returns null if fewer than 14 days of both weight and calorie data.
 */
export function computeTDEEEstimate(
  weightHistory: WeightPoint[],
  caloriesByDate: Record<string, number>,
  windowDays: number = 28,
): TDEEEstimate | null {
  if (windowDays <= 0) return null;
  if (weightHistory.length < MIN_DATA_DAYS) return null;

  const calorieDays = Object.keys(caloriesByDate);
  if (calorieDays.length < MIN_DATA_DAYS) return null;

  // Sort weight history by date
  const sorted = [...weightHistory].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  // Take only the last windowDays of data
  const latestDate = new Date(sorted[sorted.length - 1].date);
  const cutoffDate = new Date(latestDate);
  cutoffDate.setDate(cutoffDate.getDate() - windowDays);

  const windowWeights = sorted.filter(
    (w) => new Date(w.date) >= cutoffDate,
  );

  if (windowWeights.length < MIN_DATA_DAYS) return null;

  // Compute EMA at start and end of window
  const weights = windowWeights.map((w) => w.weight_kg);
  const firstHalf = weights.slice(0, Math.ceil(weights.length / 2));
  const emaStart = computeEMA(firstHalf);
  const emaEnd = computeEMA(weights);

  const weightChangeKg = emaEnd - emaStart;

  // Average daily calories within the window
  const cutoffStr = cutoffDate.toISOString().split('T')[0];
  const windowCalorieDays = calorieDays.filter((d) => d >= cutoffStr);
  if (windowCalorieDays.length < MIN_DATA_DAYS) return null;

  const totalCalories = windowCalorieDays.reduce(
    (sum, d) => sum + caloriesByDate[d],
    0,
  );
  const avgDailyCalories = totalCalories / windowCalorieDays.length;

  const tdee = avgDailyCalories + (weightChangeKg * KCAL_PER_KG) / windowDays;

  return {
    tdee,
    windowDays,
    avgDailyCalories,
    weightChangeKg,
  };
}
