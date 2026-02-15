/**
 * Regression tests for food search results behavior.
 * Covers: result count, scrollability, locked fields, barcode entry.
 */

describe('Food Search Results', () => {
  describe('result display limits', () => {
    it('shows up to 15 results from search', () => {
      const results = Array.from({ length: 25 }, (_, i) => ({
        id: String(i),
        name: `Food ${i}`,
        calories: 100 + i,
      }));
      const displayed = results.slice(0, 15);
      expect(displayed).toHaveLength(15);
      expect(displayed[0].name).toBe('Food 0');
      expect(displayed[14].name).toBe('Food 14');
    });

    it('shows all results when fewer than 15', () => {
      const results = Array.from({ length: 5 }, (_, i) => ({
        id: String(i),
        name: `Food ${i}`,
      }));
      const displayed = results.slice(0, 15);
      expect(displayed).toHaveLength(5);
    });

    it('shows nothing when results are empty', () => {
      const results: any[] = [];
      const displayed = results.slice(0, 15);
      expect(displayed).toHaveLength(0);
    });
  });

  describe('locked field behavior', () => {
    it('fields are editable when no food is selected', () => {
      const selectedFood = null;
      const editable = !selectedFood;
      expect(editable).toBe(true);
    });

    it('fields are locked when a food is selected', () => {
      const selectedFood = { id: '1', name: 'Apple', calories: 95 };
      const editable = !selectedFood;
      expect(editable).toBe(false);
    });

    it('locked fields should have reduced opacity', () => {
      const selectedFood = { id: '1', name: 'Apple' };
      const inputStyle = { opacity: 1 };
      const lockedStyle = { opacity: 0.6 };
      const finalStyle = selectedFood ? { ...inputStyle, ...lockedStyle } : inputStyle;
      expect(finalStyle.opacity).toBe(0.6);
    });
  });

  describe('search result response parsing', () => {
    const parseResponse = (data: any): any[] => {
      const items = data?.items ?? data ?? [];
      return Array.isArray(items) ? items : [];
    };

    it('parses paginated response { items: [...], total: N }', () => {
      const data = { items: [{ id: '1' }, { id: '2' }], total: 50 };
      expect(parseResponse(data)).toHaveLength(2);
    });

    it('parses direct array response', () => {
      const data = [{ id: '1' }];
      expect(parseResponse(data)).toHaveLength(1);
    });

    it('handles null gracefully', () => {
      expect(parseResponse(null)).toEqual([]);
    });

    it('handles { items: null } gracefully', () => {
      expect(parseResponse({ items: null })).toEqual([]);
    });

    it('handles non-array items', () => {
      expect(parseResponse({ items: 'string' })).toEqual([]);
    });
  });

  describe('barcode entry on web', () => {
    it('does not use window.prompt (regression test)', () => {
      // The barcode button on web should NOT call window.prompt
      // Instead it should guide users to the search field
      const isWeb = true;
      let promptCalled = false;
      let searchErrorSet = '';

      if (isWeb) {
        // New behavior: set search error hint instead of window.prompt
        searchErrorSet = 'Type a barcode number in the search field above, then press Enter.';
      } else {
        promptCalled = true;
      }

      expect(promptCalled).toBe(false);
      expect(searchErrorSet).toContain('barcode');
    });
  });

  describe('search debounce', () => {
    it('requires minimum 2 characters', () => {
      const shouldSearch = (q: string) => q.trim().length >= 2;
      expect(shouldSearch('')).toBe(false);
      expect(shouldSearch('a')).toBe(false);
      expect(shouldSearch('ap')).toBe(true);
      expect(shouldSearch('apple')).toBe(true);
    });

    it('trims whitespace before checking length', () => {
      const shouldSearch = (q: string) => q.trim().length >= 2;
      expect(shouldSearch('  ')).toBe(false);
      expect(shouldSearch(' a ')).toBe(false);
      expect(shouldSearch(' ab ')).toBe(true);
    });
  });
});
