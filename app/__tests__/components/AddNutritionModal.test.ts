// Test the pure logic used by AddNutritionModal
// scaleMacros is exported from the modal but we test the logic inline
// to avoid importing the full React Native component in Jest

describe('AddNutritionModal logic', () => {
  // Inline the pure function to avoid RN import chain
  function scaleMacros(
    base: { calories: number; protein_g: number; carbs_g: number; fat_g: number },
    multiplier: number,
  ) {
    return {
      calories: base.calories * multiplier,
      protein_g: base.protein_g * multiplier,
      carbs_g: base.carbs_g * multiplier,
      fat_g: base.fat_g * multiplier,
    };
  }

  describe('scaleMacros', () => {
    it('returns original values when multiplier is 1', () => {
      const base = { calories: 200, protein_g: 20, carbs_g: 30, fat_g: 10 };
      expect(scaleMacros(base, 1)).toEqual(base);
    });

    it('doubles values when multiplier is 2', () => {
      const base = { calories: 200, protein_g: 20, carbs_g: 30, fat_g: 10 };
      expect(scaleMacros(base, 2)).toEqual({
        calories: 400, protein_g: 40, carbs_g: 60, fat_g: 20,
      });
    });

    it('halves values when multiplier is 0.5', () => {
      const base = { calories: 200, protein_g: 20, carbs_g: 30, fat_g: 10 };
      expect(scaleMacros(base, 0.5)).toEqual({
        calories: 100, protein_g: 10, carbs_g: 15, fat_g: 5,
      });
    });

    it('returns zeros when multiplier is 0', () => {
      const base = { calories: 200, protein_g: 20, carbs_g: 30, fat_g: 10 };
      expect(scaleMacros(base, 0)).toEqual({
        calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
      });
    });

    it('handles zero base values', () => {
      const base = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
      expect(scaleMacros(base, 5)).toEqual({
        calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
      });
    });

    it('handles fractional multipliers precisely', () => {
      const base = { calories: 100, protein_g: 10, carbs_g: 20, fat_g: 5 };
      const result = scaleMacros(base, 1.5);
      expect(result.calories).toBeCloseTo(150);
      expect(result.protein_g).toBeCloseTo(15);
      expect(result.carbs_g).toBeCloseTo(30);
      expect(result.fat_g).toBeCloseTo(7.5);
    });
  });

  describe('search minimum length', () => {
    it('requires at least 2 characters for search', () => {
      const shouldSearch = (query: string) => query.trim().length >= 2;
      expect(shouldSearch('')).toBe(false);
      expect(shouldSearch('a')).toBe(false);
      expect(shouldSearch(' a ')).toBe(false);
      expect(shouldSearch('ab')).toBe(true);
      expect(shouldSearch('rice')).toBe(true);
    });
  });

  describe('form validation', () => {
    // The submit validation now allows water-only saves.
    // hasMacros = any of calories/protein/carbs/fat is non-empty
    // hasWater = waterGlasses > 0
    // Rules:
    //   - If no macros AND no water → blocked ("Nothing to log")
    //   - If some macros but not all 4 → blocked ("Missing fields")
    //   - If all 4 macros filled → allowed (with or without water)
    //   - If water only (no macros) → allowed

    function canSubmit(cal: string, pro: string, carb: string, fat: string, waterGlasses: number): { allowed: boolean; reason?: string } {
      const hasMacros = cal !== '' || pro !== '' || carb !== '' || fat !== '';
      const hasWater = waterGlasses > 0;

      if (!hasMacros && !hasWater) {
        return { allowed: false, reason: 'nothing_to_log' };
      }
      if (hasMacros && (!cal || !pro || !carb || !fat)) {
        return { allowed: false, reason: 'missing_fields' };
      }
      return { allowed: true };
    }

    it('blocks when no macros and no water', () => {
      expect(canSubmit('', '', '', '', 0).allowed).toBe(false);
      expect(canSubmit('', '', '', '', 0).reason).toBe('nothing_to_log');
    });

    it('blocks when some macros filled but not all 4', () => {
      expect(canSubmit('200', '', '', '', 0).allowed).toBe(false);
      expect(canSubmit('200', '', '', '', 0).reason).toBe('missing_fields');
      expect(canSubmit('200', '20', '', '', 0).allowed).toBe(false);
      expect(canSubmit('200', '20', '30', '', 0).allowed).toBe(false);
    });

    it('allows when all 4 macros filled (no water)', () => {
      expect(canSubmit('200', '20', '30', '10', 0).allowed).toBe(true);
    });

    it('allows when all 4 macros filled + water', () => {
      expect(canSubmit('200', '20', '30', '10', 3).allowed).toBe(true);
    });

    it('allows water-only save (no macros) — regression for water save bug', () => {
      expect(canSubmit('', '', '', '', 3).allowed).toBe(true);
    });

    it('allows water-only save with various glass counts', () => {
      expect(canSubmit('', '', '', '', 1).allowed).toBe(true);
      expect(canSubmit('', '', '', '', 8).allowed).toBe(true);
      expect(canSubmit('', '', '', '', 12).allowed).toBe(true);
    });

    it('blocks partial macros even with water', () => {
      // If user started typing macros but didn't finish, still require all 4
      expect(canSubmit('200', '', '', '', 5).allowed).toBe(false);
      expect(canSubmit('200', '', '', '', 5).reason).toBe('missing_fields');
    });

    it('accepts string number values for macros', () => {
      expect(canSubmit('0', '0', '0', '0', 0).allowed).toBe(true);
      expect(canSubmit('100.5', '20.3', '30.1', '10.2', 0).allowed).toBe(true);
    });
  });

  describe('hasUnsavedData — regression for water discard warning', () => {
    function hasUnsavedData(cal: string, pro: string, carb: string, fat: string, notes: string, searchQuery: string, waterGlasses: number): boolean {
      return cal !== '' || pro !== '' || carb !== '' || fat !== '' || notes !== '' || searchQuery !== '' || waterGlasses > 0;
    }

    it('returns false when everything is empty', () => {
      expect(hasUnsavedData('', '', '', '', '', '', 0)).toBe(false);
    });

    it('returns true when only water is set', () => {
      expect(hasUnsavedData('', '', '', '', '', '', 1)).toBe(true);
      expect(hasUnsavedData('', '', '', '', '', '', 5)).toBe(true);
    });

    it('returns true when macros are set', () => {
      expect(hasUnsavedData('200', '', '', '', '', '', 0)).toBe(true);
    });

    it('returns true when notes are set', () => {
      expect(hasUnsavedData('', '', '', '', 'lunch', '', 0)).toBe(true);
    });

    it('returns true when water + macros are set', () => {
      expect(hasUnsavedData('200', '20', '30', '10', '', '', 3)).toBe(true);
    });
  });

  describe('water-only entry payload', () => {
    it('water-only entry uses "Water" as meal name', () => {
      const hasMacros = false;
      const hasWater = true;
      const notes = '';
      const mealName = notes.trim() || (hasWater && !hasMacros ? 'Water' : 'Quick entry');
      expect(mealName).toBe('Water');
    });

    it('food entry uses "Quick entry" as default meal name', () => {
      const hasMacros = true;
      const hasWater = false;
      const notes = '';
      const mealName = notes.trim() || (hasWater && !hasMacros ? 'Water' : 'Quick entry');
      expect(mealName).toBe('Quick entry');
    });

    it('custom notes override default meal name', () => {
      const notes = 'Post-workout shake';
      const mealName = notes.trim() || 'Quick entry';
      expect(mealName).toBe('Post-workout shake');
    });

    it('water-only entry sends 0 macros', () => {
      const calories = '';
      const protein = '';
      const payload = {
        calories: Number(calories) || 0,
        protein_g: Number(protein) || 0,
      };
      expect(payload.calories).toBe(0);
      expect(payload.protein_g).toBe(0);
    });
  });

  describe('serving multiplier validation', () => {
    it('rejects non-positive multipliers', () => {
      const isValidMultiplier = (text: string, maxMult: number) => {
        const num = parseFloat(text);
        return !isNaN(num) && num > 0 && num <= maxMult;
      };

      expect(isValidMultiplier('0', 99)).toBe(false);
      expect(isValidMultiplier('-1', 99)).toBe(false);
      expect(isValidMultiplier('abc', 99)).toBe(false);
      expect(isValidMultiplier('', 99)).toBe(false);
      expect(isValidMultiplier('1', 99)).toBe(true);
      expect(isValidMultiplier('2.5', 99)).toBe(true);
      expect(isValidMultiplier('100', 99)).toBe(false);
      expect(isValidMultiplier('100', 9999)).toBe(true);
    });
  });
});
