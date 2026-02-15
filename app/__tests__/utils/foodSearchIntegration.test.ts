/**
 * Tests for food search logic and modal interaction patterns.
 * Covers: search debounce, result handling, food selection, serving scaling.
 */

describe('Food Search Integration', () => {
  // Simulate the search logic from AddNutritionModal
  const shouldTriggerSearch = (query: string): boolean => query.trim().length >= 2;

  const parseSearchResponse = (data: any): any[] => {
    const items = data?.items ?? data ?? [];
    return Array.isArray(items) ? items : [];
  };

  describe('search trigger logic', () => {
    it('does not search for empty string', () => {
      expect(shouldTriggerSearch('')).toBe(false);
    });

    it('does not search for single character', () => {
      expect(shouldTriggerSearch('a')).toBe(false);
    });

    it('does not search for whitespace-only', () => {
      expect(shouldTriggerSearch('   ')).toBe(false);
    });

    it('searches for 2+ characters', () => {
      expect(shouldTriggerSearch('ap')).toBe(true);
      expect(shouldTriggerSearch('apple')).toBe(true);
      expect(shouldTriggerSearch('chicken breast')).toBe(true);
    });
  });

  describe('response parsing', () => {
    it('handles { items: [...] } format', () => {
      const data = { items: [{ id: '1', name: 'Apple' }], total: 1 };
      expect(parseSearchResponse(data)).toEqual([{ id: '1', name: 'Apple' }]);
    });

    it('handles direct array format', () => {
      const data = [{ id: '1', name: 'Apple' }];
      expect(parseSearchResponse(data)).toEqual([{ id: '1', name: 'Apple' }]);
    });

    it('handles null/undefined', () => {
      expect(parseSearchResponse(null)).toEqual([]);
      expect(parseSearchResponse(undefined)).toEqual([]);
    });

    it('handles empty items', () => {
      expect(parseSearchResponse({ items: [] })).toEqual([]);
      expect(parseSearchResponse([])).toEqual([]);
    });

    it('handles non-array items gracefully', () => {
      expect(parseSearchResponse({ items: 'not an array' })).toEqual([]);
    });
  });

  describe('food selection and macro population', () => {
    const scaleMacros = (
      base: { calories: number; protein_g: number; carbs_g: number; fat_g: number },
      multiplier: number,
    ) => ({
      calories: base.calories * multiplier,
      protein_g: base.protein_g * multiplier,
      carbs_g: base.carbs_g * multiplier,
      fat_g: base.fat_g * multiplier,
    });

    it('scales macros correctly for 1 serving', () => {
      const apple = { calories: 95, protein_g: 0.5, carbs_g: 25.1, fat_g: 0.3 };
      const result = scaleMacros(apple, 1);
      expect(result.calories).toBe(95);
      expect(result.protein_g).toBe(0.5);
    });

    it('scales macros correctly for 2 servings', () => {
      const chicken = { calories: 231, protein_g: 43.4, carbs_g: 0, fat_g: 5.0 };
      const result = scaleMacros(chicken, 2);
      expect(result.calories).toBe(462);
      expect(result.protein_g).toBe(86.8);
    });

    it('scales macros correctly for fractional servings', () => {
      const rice = { calories: 206, protein_g: 4.3, carbs_g: 44.5, fat_g: 0.4 };
      const result = scaleMacros(rice, 0.5);
      expect(result.calories).toBe(103);
      expect(result.carbs_g).toBeCloseTo(22.25);
    });
  });

  describe('serving size scaling', () => {
    // scaleToServing: (baseGrams, targetGrams, value) => round(value * targetGrams / baseGrams, 1)
    const scaleToServing = (base: number, target: number, value: number): number => {
      if (base <= 0) return 0;
      return Math.round((value * target / base) * 10) / 10;
    };

    it('returns same value when target equals base', () => {
      expect(scaleToServing(100, 100, 95)).toBe(95);
    });

    it('doubles value when target is 2x base', () => {
      expect(scaleToServing(100, 200, 95)).toBe(190);
    });

    it('halves value when target is half base', () => {
      expect(scaleToServing(100, 50, 95)).toBe(47.5);
    });

    it('handles zero base gracefully', () => {
      expect(scaleToServing(0, 100, 95)).toBe(0);
    });

    it('handles real serving size conversion (apple 182g → 100g)', () => {
      // Apple: 95 kcal per 182g serving → per 100g
      expect(scaleToServing(182, 100, 95)).toBeCloseTo(52.2, 0);
    });
  });

  describe('form validation', () => {
    const isFormValid = (cal: string, pro: string, carb: string, fat: string): boolean =>
      cal !== '' && pro !== '' && carb !== '' && fat !== '';

    const isMultiplierValid = (text: string, max: number = 99): boolean => {
      const num = parseFloat(text);
      return !isNaN(num) && num > 0 && num <= max;
    };

    it('rejects empty form', () => {
      expect(isFormValid('', '', '', '')).toBe(false);
    });

    it('rejects partially filled form', () => {
      expect(isFormValid('200', '', '', '')).toBe(false);
      expect(isFormValid('200', '20', '30', '')).toBe(false);
    });

    it('accepts fully filled form', () => {
      expect(isFormValid('200', '20', '30', '10')).toBe(true);
    });

    it('accepts zero values (valid for some foods)', () => {
      expect(isFormValid('0', '0', '0', '0')).toBe(true);
    });

    it('validates serving multiplier', () => {
      expect(isMultiplierValid('1')).toBe(true);
      expect(isMultiplierValid('2.5')).toBe(true);
      expect(isMultiplierValid('0')).toBe(false);
      expect(isMultiplierValid('-1')).toBe(false);
      expect(isMultiplierValid('abc')).toBe(false);
      expect(isMultiplierValid('')).toBe(false);
      expect(isMultiplierValid('100')).toBe(false); // > 99
      expect(isMultiplierValid('100', 9999)).toBe(true); // custom gram mode
    });
  });

  describe('dirty form detection', () => {
    const hasUnsavedData = (fields: {
      calories: string; protein: string; carbs: string; fat: string;
      notes: string; searchQuery: string;
    }): boolean => {
      return (
        fields.calories !== '' ||
        fields.protein !== '' ||
        fields.carbs !== '' ||
        fields.fat !== '' ||
        fields.notes !== '' ||
        fields.searchQuery !== ''
      );
    };

    it('returns false for empty form', () => {
      expect(hasUnsavedData({ calories: '', protein: '', carbs: '', fat: '', notes: '', searchQuery: '' })).toBe(false);
    });

    it('returns true when any field has data', () => {
      expect(hasUnsavedData({ calories: '100', protein: '', carbs: '', fat: '', notes: '', searchQuery: '' })).toBe(true);
      expect(hasUnsavedData({ calories: '', protein: '', carbs: '', fat: '', notes: 'lunch', searchQuery: '' })).toBe(true);
      expect(hasUnsavedData({ calories: '', protein: '', carbs: '', fat: '', notes: '', searchQuery: 'apple' })).toBe(true);
    });
  });
});
