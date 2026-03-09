/**
 * Unit tests for extended generateWarmUpSets.
 * Tests: previousBestWeight fallback, backward compatibility, edge cases.
 */

import { generateWarmUpSets, WarmUpSet } from '../../utils/warmUpGenerator';

describe('generateWarmUpSets', () => {
  // ── Backward compatibility (existing callers) ──

  describe('backward compatibility — single number arg', () => {
    it('generates warm-up sets for 100kg working weight', () => {
      const sets = generateWarmUpSets(100);
      expect(sets.length).toBeGreaterThanOrEqual(2);
      expect(sets[0].weightKg).toBe(20); // bar only
      expect(sets[0].reps).toBe(10);
      expect(sets.every((s) => s.setType === 'warm-up')).toBe(true);
    });

    it('returns empty for weight at or below bar', () => {
      expect(generateWarmUpSets(20)).toEqual([]);
      expect(generateWarmUpSets(15)).toEqual([]);
    });

    it('returns empty for undefined working weight', () => {
      expect(generateWarmUpSets(undefined)).toEqual([]);
    });

    it('accepts custom bar weight as second number arg', () => {
      const sets = generateWarmUpSets(100, 25);
      expect(sets[0].weightKg).toBe(25);
    });
  });

  // ── previousBestWeight fallback ──

  describe('previousBestWeight fallback', () => {
    it('uses previousBestWeight when workingWeight is undefined', () => {
      const sets = generateWarmUpSets(undefined, { previousBestWeight: 100 });
      expect(sets.length).toBeGreaterThanOrEqual(2);
      expect(sets[0].weightKg).toBe(20); // bar
    });

    it('ignores previousBestWeight when workingWeight is provided', () => {
      const setsWithWorking = generateWarmUpSets(80, { previousBestWeight: 120 });
      const setsWithoutPrev = generateWarmUpSets(80);
      // Should produce same sets since workingWeight takes priority
      expect(setsWithWorking).toEqual(setsWithoutPrev);
    });

    it('returns empty when previousBestWeight is at or below bar', () => {
      expect(generateWarmUpSets(undefined, { previousBestWeight: 20 })).toEqual([]);
      expect(generateWarmUpSets(undefined, { previousBestWeight: 15 })).toEqual([]);
    });

    it('returns empty when neither weight is provided', () => {
      expect(generateWarmUpSets(undefined, {})).toEqual([]);
      expect(generateWarmUpSets(undefined, { previousBestWeight: undefined })).toEqual([]);
    });

    it('respects custom barWeightKg in options', () => {
      const sets = generateWarmUpSets(undefined, { previousBestWeight: 100, barWeightKg: 15 });
      expect(sets[0].weightKg).toBe(15);
    });
  });

  // ── Set generation logic ──

  describe('set generation', () => {
    it('always starts with bar-only set at 10 reps', () => {
      const sets = generateWarmUpSets(100);
      expect(sets[0]).toEqual({ weightKg: 20, reps: 10, setType: 'warm-up' });
    });

    it('includes 60% set at 5 reps when meaningfully above bar', () => {
      const sets = generateWarmUpSets(100);
      const sixtyPct = Math.round(100 * 0.6 / 2.5) * 2.5; // 60
      const hasSixty = sets.some((s) => s.weightKg === sixtyPct && s.reps === 5);
      expect(hasSixty).toBe(true);
    });

    it('includes 80% set at 3 reps when above previous set', () => {
      const sets = generateWarmUpSets(100);
      const eightyPct = Math.round(100 * 0.8 / 2.5) * 2.5; // 80
      const hasEighty = sets.some((s) => s.weightKg === eightyPct && s.reps === 3);
      expect(hasEighty).toBe(true);
    });

    it('skips 60% set when it equals bar weight', () => {
      // 40kg working weight: 60% = 24 → rounds to 22.5 → > 20 bar, so included
      // 35kg: 60% = 21 → rounds to 20 → equals bar, so skipped
      const sets = generateWarmUpSets(35);
      // Should only have bar set (20kg) and possibly 80% (28 → 27.5)
      expect(sets[0].weightKg).toBe(20);
      expect(sets.filter((s) => s.reps === 5).length).toBe(0); // no 60% set
    });

    it('weights are rounded to nearest 2.5kg', () => {
      const sets = generateWarmUpSets(100);
      for (const s of sets) {
        expect(s.weightKg % 2.5).toBe(0);
      }
    });

    it('all sets have setType warm-up', () => {
      const sets = generateWarmUpSets(120, { previousBestWeight: 100 });
      expect(sets.every((s) => s.setType === 'warm-up')).toBe(true);
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles very heavy weight (200kg)', () => {
      const sets = generateWarmUpSets(200);
      expect(sets.length).toBe(3); // bar, 60%, 80%
      expect(sets[sets.length - 1].weightKg).toBeLessThan(200);
    });

    it('handles light weight just above bar (25kg)', () => {
      const sets = generateWarmUpSets(25);
      expect(sets.length).toBeGreaterThanOrEqual(1);
      expect(sets[0].weightKg).toBe(20);
    });

    it('previousBestWeight produces same sets as direct working weight', () => {
      const direct = generateWarmUpSets(100);
      const fromPrev = generateWarmUpSets(undefined, { previousBestWeight: 100 });
      expect(direct).toEqual(fromPrev);
    });
  });
});
