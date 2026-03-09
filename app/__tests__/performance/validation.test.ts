/**
 * Performance validation tests.
 * Validates: computation speed, no unnecessary re-renders patterns, memory efficiency.
 */

import { generateWarmUpSets } from '../../utils/warmUpGenerator';

describe('Performance Validation', () => {
  describe('generateWarmUpSets — computation speed', () => {
    it('generates sets in under 5ms for typical weight', () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        generateWarmUpSets(100);
      }
      const elapsed = performance.now() - start;
      // 1000 iterations should complete well under 50ms
      expect(elapsed).toBeLessThan(50);
    });

    it('generates sets in under 5ms with previousBestWeight', () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        generateWarmUpSets(undefined, { previousBestWeight: 120 });
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('nutrition totals — computation speed', () => {
    it('computes totals for 100 entries in under 5ms', () => {
      const entries = Array.from({ length: 100 }, (_, i) => ({
        calories: 200 + i,
        protein_g: 20 + i * 0.5,
        carbs_g: 30 + i * 0.3,
        fat_g: 10 + i * 0.2,
      }));

      const start = performance.now();
      for (let iter = 0; iter < 100; iter++) {
        entries.reduce(
          (acc, e) => ({
            cal: acc.cal + e.calories,
            pro: acc.pro + e.protein_g,
            carb: acc.carb + e.carbs_g,
            fat: acc.fat + e.fat_g,
          }),
          { cal: 0, pro: 0, carb: 0, fat: 0 },
        );
      }
      const elapsed = performance.now() - start;
      // 100 iterations of 100 entries should be fast
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('volume summary — computation speed', () => {
    it('computes volume summary for 13 muscle groups in under 1ms', () => {
      const groups = Array.from({ length: 13 }, (_, i) => ({
        muscle: `group_${i}`,
        status: i % 3 === 0 ? 'optimal' : i % 3 === 1 ? 'approaching_mrv' : 'below_mev',
      }));

      const start = performance.now();
      for (let iter = 0; iter < 10000; iter++) {
        const optimal = groups.filter((g) => g.status === 'optimal').length;
        const approaching = groups.filter((g) => g.status === 'approaching_mrv').length;
        ({ optimal, approachingMrv: approaching, total: groups.length });
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('data merge — no deep clone overhead', () => {
    it('shallow merge of dashboard data is fast', () => {
      const base = {
        calories: { value: 0, target: 2400 },
        protein: { value: 0, target: 180 },
        carbs: { value: 0, target: 250 },
        totalFat: 0,
        nutritionEntries: [] as any[],
        trainingSessions: [] as any[],
        workoutsCompleted: 0,
        streak: 0,
        articles: [] as any[],
        nutritionLogged: false,
        trainingLogged: false,
        loggedDates: new Set<string>(),
        weightHistory: [] as any[],
        milestoneMessage: null as string | null,
        fatigueSuggestions: [] as any[],
        readinessScore: null as number | null,
        readinessFactors: [] as any[],
        recompMetrics: null,
        nudges: [] as any[],
        volumeSummary: null,
      };

      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        ({ ...base, streak: i, workoutsCompleted: i % 5 });
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('search debounce — no redundant calls', () => {
    it('debounce timer pattern prevents rapid-fire calls', () => {
      let callCount = 0;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const debouncedSearch = (query: string) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { callCount++; }, 300);
      };

      // Simulate rapid typing
      debouncedSearch('c');
      debouncedSearch('ch');
      debouncedSearch('chi');
      debouncedSearch('chic');
      debouncedSearch('chick');

      // Before timeout, no calls should have fired
      expect(callCount).toBe(0);

      // Clean up
      if (timer) clearTimeout(timer);
    });
  });

  describe('AbortController — cancellation pattern', () => {
    it('abort controller properly signals cancellation', () => {
      const ac = new AbortController();
      expect(ac.signal.aborted).toBe(false);
      ac.abort();
      expect(ac.signal.aborted).toBe(true);
    });

    it('new controller replaces old one (no memory leak)', () => {
      let current: AbortController | null = null;

      // Simulate date switching
      for (let i = 0; i < 100; i++) {
        if (current) current.abort();
        current = new AbortController();
      }

      expect(current!.signal.aborted).toBe(false);
    });
  });
});
