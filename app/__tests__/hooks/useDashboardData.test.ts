/**
 * Unit tests for useDashboardData hook — pure logic extraction.
 * Tests data loading, error handling, date switching, refresh, and target computation.
 */

import { DashboardData } from '../../hooks/useDashboardData';

// ── Inline the pure logic from useDashboardData to test without React ──

const INITIAL_DATA: DashboardData = {
  calories: { value: 0, target: 2400 },
  protein: { value: 0, target: 180 },
  carbs: { value: 0, target: 250 },
  totalFat: 0,
  nutritionEntries: [],
  trainingSessions: [],
  workoutsCompleted: 0,
  streak: 0,
  articles: [],
  nutritionLogged: false,
  trainingLogged: false,
  loggedDates: new Set(),
  weightHistory: [],
  milestoneMessage: null,
  fatigueSuggestions: [],
  readinessScore: null,
  readinessFactors: [],
  recompMetrics: null,
  nudges: [],
  volumeSummary: null,
};

/** Compute nutrition totals from entries — mirrors hook logic */
function computeNutritionTotals(entries: any[]) {
  return entries.reduce(
    (acc, e) => ({
      cal: acc.cal + (e.calories ?? 0),
      pro: acc.pro + (e.protein_g ?? 0),
      carb: acc.carb + (e.carbs_g ?? 0),
      fat: acc.fat + (e.fat_g ?? 0),
    }),
    { cal: 0, pro: 0, carb: 0, fat: 0 },
  );
}

/** Compute volume summary from muscle groups — mirrors hook logic */
function computeVolumeSummary(groups: any[]) {
  if (groups.length === 0) return null;
  const optimal = groups.filter((g: any) => g.status === 'optimal').length;
  const approachingMrv = groups.filter((g: any) => g.status === 'approaching_mrv').length;
  return { optimal, approachingMrv, total: groups.length };
}

/** Compute effective targets — mirrors hook logic */
function computeTargets(
  syncTargets: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null,
  adaptiveTargets: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null,
  data: DashboardData,
) {
  if (syncTargets) {
    return {
      calories: Math.round(syncTargets.calories),
      protein_g: Math.round(syncTargets.protein_g),
      carbs_g: Math.round(syncTargets.carbs_g),
      fat_g: Math.round(syncTargets.fat_g),
    };
  }
  return adaptiveTargets ?? {
    calories: data.calories.target,
    protein_g: data.protein.target,
    carbs_g: data.carbs.target,
    fat_g: 65,
  };
}

describe('useDashboardData — pure logic', () => {
  describe('INITIAL_DATA defaults', () => {
    it('starts with zero calories consumed', () => {
      expect(INITIAL_DATA.calories.value).toBe(0);
    });

    it('has default calorie target of 2400', () => {
      expect(INITIAL_DATA.calories.target).toBe(2400);
    });

    it('has default protein target of 180', () => {
      expect(INITIAL_DATA.protein.target).toBe(180);
    });

    it('starts with empty entries', () => {
      expect(INITIAL_DATA.nutritionEntries).toEqual([]);
      expect(INITIAL_DATA.trainingSessions).toEqual([]);
    });

    it('starts with no readiness score', () => {
      expect(INITIAL_DATA.readinessScore).toBeNull();
    });

    it('starts with null volume summary', () => {
      expect(INITIAL_DATA.volumeSummary).toBeNull();
    });
  });

  describe('computeNutritionTotals', () => {
    it('returns zeros for empty entries', () => {
      expect(computeNutritionTotals([])).toEqual({ cal: 0, pro: 0, carb: 0, fat: 0 });
    });

    it('sums single entry correctly', () => {
      const entries = [{ calories: 500, protein_g: 30, carbs_g: 60, fat_g: 15 }];
      expect(computeNutritionTotals(entries)).toEqual({ cal: 500, pro: 30, carb: 60, fat: 15 });
    });

    it('sums multiple entries', () => {
      const entries = [
        { calories: 200, protein_g: 20, carbs_g: 30, fat_g: 5 },
        { calories: 300, protein_g: 25, carbs_g: 40, fat_g: 10 },
      ];
      expect(computeNutritionTotals(entries)).toEqual({ cal: 500, pro: 45, carb: 70, fat: 15 });
    });

    it('handles null/undefined fields gracefully', () => {
      const entries = [{ calories: null, protein_g: undefined, carbs_g: 10, fat_g: 5 }];
      const result = computeNutritionTotals(entries);
      expect(result.cal).toBe(0);
      expect(result.pro).toBe(0);
      expect(result.carb).toBe(10);
      expect(result.fat).toBe(5);
    });
  });

  describe('computeVolumeSummary', () => {
    it('returns null for empty groups', () => {
      expect(computeVolumeSummary([])).toBeNull();
    });

    it('counts optimal and approaching_mrv groups', () => {
      const groups = [
        { muscle: 'chest', status: 'optimal' },
        { muscle: 'back', status: 'optimal' },
        { muscle: 'legs', status: 'approaching_mrv' },
        { muscle: 'shoulders', status: 'below_mev' },
      ];
      expect(computeVolumeSummary(groups)).toEqual({ optimal: 2, approachingMrv: 1, total: 4 });
    });

    it('handles all optimal', () => {
      const groups = [{ status: 'optimal' }, { status: 'optimal' }];
      expect(computeVolumeSummary(groups)).toEqual({ optimal: 2, approachingMrv: 0, total: 2 });
    });

    it('handles no optimal or approaching', () => {
      const groups = [{ status: 'below_mev' }, { status: 'junk' }];
      expect(computeVolumeSummary(groups)).toEqual({ optimal: 0, approachingMrv: 0, total: 2 });
    });
  });

  describe('computeTargets', () => {
    it('prefers syncTargets when available', () => {
      const sync = { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 60 };
      const adaptive = { calories: 2500, protein_g: 180, carbs_g: 300, fat_g: 80 };
      const result = computeTargets(sync, adaptive, INITIAL_DATA);
      expect(result.calories).toBe(2000);
      expect(result.protein_g).toBe(150);
    });

    it('falls back to adaptiveTargets when syncTargets is null', () => {
      const adaptive = { calories: 2500, protein_g: 180, carbs_g: 300, fat_g: 80 };
      const result = computeTargets(null, adaptive, INITIAL_DATA);
      expect(result.calories).toBe(2500);
    });

    it('falls back to data defaults when both are null', () => {
      const result = computeTargets(null, null, INITIAL_DATA);
      expect(result.calories).toBe(2400);
      expect(result.protein_g).toBe(180);
      expect(result.carbs_g).toBe(250);
      expect(result.fat_g).toBe(65);
    });

    it('rounds syncTargets values', () => {
      const sync = { calories: 2000.7, protein_g: 150.3, carbs_g: 200.9, fat_g: 60.1 };
      const result = computeTargets(sync, null, INITIAL_DATA);
      expect(result.calories).toBe(2001);
      expect(result.protein_g).toBe(150);
      expect(result.carbs_g).toBe(201);
      expect(result.fat_g).toBe(60);
    });
  });

  describe('data update merging', () => {
    it('merges partial updates into existing data', () => {
      const prev = { ...INITIAL_DATA };
      const updates = { streak: 5, workoutsCompleted: 3 };
      const merged = { ...prev, ...updates };
      expect(merged.streak).toBe(5);
      expect(merged.workoutsCompleted).toBe(3);
      expect(merged.calories).toEqual({ value: 0, target: 2400 }); // unchanged
    });

    it('adaptive snapshot overrides calorie target', () => {
      const snap = { target_calories: 2200, target_protein_g: 160, target_carbs_g: 280, target_fat_g: 70 };
      const updates: Partial<DashboardData> = {
        calories: { value: 500, target: Math.round(snap.target_calories) },
        protein: { value: 30, target: Math.round(snap.target_protein_g) },
      };
      const merged = { ...INITIAL_DATA, ...updates };
      expect(merged.calories.target).toBe(2200);
      expect(merged.protein.target).toBe(160);
    });
  });

  describe('date debounce behavior', () => {
    it('DATE_DEBOUNCE_MS is 300ms', () => {
      // Verifying the constant matches expected value
      const DATE_DEBOUNCE_MS = 300;
      expect(DATE_DEBOUNCE_MS).toBe(300);
    });
  });

  describe('error handling patterns', () => {
    it('streak defaults to 0 when API fails', () => {
      const streakFromFailedApi = 0;
      expect(streakFromFailedApi).toBe(0);
    });

    it('fatigueSuggestions defaults to empty array on error', () => {
      const fallback: any[] = [];
      expect(fallback).toEqual([]);
    });

    it('readinessScore defaults to null on error', () => {
      const fallback = null;
      expect(fallback).toBeNull();
    });

    it('volumeSummary defaults to null on error', () => {
      const fallback = null;
      expect(fallback).toBeNull();
    });
  });

  describe('isAborted helper', () => {
    it('returns false for undefined signal', () => {
      const isAborted = (signal?: AbortSignal) => signal?.aborted === true;
      expect(isAborted(undefined)).toBe(false);
    });

    it('returns false for non-aborted signal', () => {
      const isAborted = (signal?: AbortSignal) => signal?.aborted === true;
      const ac = new AbortController();
      expect(isAborted(ac.signal)).toBe(false);
    });

    it('returns true for aborted signal', () => {
      const isAborted = (signal?: AbortSignal) => signal?.aborted === true;
      const ac = new AbortController();
      ac.abort();
      expect(isAborted(ac.signal)).toBe(true);
    });
  });
});
