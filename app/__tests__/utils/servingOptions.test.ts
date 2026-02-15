import {
  scaleToServing,
  buildServingOptions,
  UNIVERSAL_OPTIONS,
  ServingOption,
} from '../../utils/servingOptions';

// ---------------------------------------------------------------------------
// scaleToServing
// ---------------------------------------------------------------------------
describe('scaleToServing', () => {
  it('returns the original value when base and target are equal', () => {
    expect(scaleToServing(100, 100, 250)).toBe(250);
  });

  it('doubles the value when target is twice the base', () => {
    expect(scaleToServing(100, 200, 250)).toBe(500);
  });

  it('halves the value when target is half the base', () => {
    expect(scaleToServing(100, 50, 200)).toBe(100);
  });

  it('returns the original value (guard) when baseGrams is zero', () => {
    // baseServingGrams <= 0 guard returns value unchanged
    expect(scaleToServing(0, 150, 200)).toBe(200);
  });

  it('returns the original value when baseGrams is negative', () => {
    expect(scaleToServing(-50, 100, 200)).toBe(200);
  });

  it('handles large serving sizes correctly (1000g)', () => {
    // 100g base → 1000g target, value 50 → 500
    expect(scaleToServing(100, 1000, 50)).toBe(500);
  });

  it('rounds to one decimal place', () => {
    // 100g base → 33g target, value 100 → 33.0
    expect(scaleToServing(100, 33, 100)).toBe(33);
    // 100g base → 37g target, value 7 → 2.59 → rounds to 2.6
    expect(scaleToServing(100, 37, 7)).toBe(2.6);
  });

  it('returns 0 when value is 0 regardless of servings', () => {
    expect(scaleToServing(100, 200, 0)).toBe(0);
  });

  it('handles fractional gram servings', () => {
    // 28.35g (1 oz) base → 56.7g (2 oz) target, value 100 → 200
    expect(scaleToServing(28.35, 56.7, 100)).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// UNIVERSAL_OPTIONS
// ---------------------------------------------------------------------------
describe('UNIVERSAL_OPTIONS', () => {
  it('contains the 1 oz option', () => {
    expect(UNIVERSAL_OPTIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '1 oz', grams: 28.35 }),
      ]),
    );
  });

  it('is a non-empty array', () => {
    expect(UNIVERSAL_OPTIONS.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// buildServingOptions
// ---------------------------------------------------------------------------
describe('buildServingOptions', () => {
  it('returns default + custom(g) + oz when no custom options provided', () => {
    const options = buildServingOptions(100, 'g');
    // Should have: default "100g", "Custom (g)", "1 oz"
    expect(options.length).toBeGreaterThanOrEqual(3);
    expect(options[0]).toEqual(
      expect.objectContaining({ label: '100g', grams: 100, isDefault: true }),
    );
    expect(options.some((o) => o.label === 'Custom (g)')).toBe(true);
    expect(options.some((o) => o.label === '1 oz')).toBe(true);
  });

  it('includes custom options when provided', () => {
    const custom: ServingOption[] = [
      { label: '1 piece', grams: 45 },
      { label: '1 katori', grams: 150 },
    ];
    const options = buildServingOptions(100, 'g', custom);
    expect(options.some((o) => o.label === '1 piece')).toBe(true);
    expect(options.some((o) => o.label === '1 katori')).toBe(true);
  });

  it('adds default serving when no custom option is marked default', () => {
    const custom: ServingOption[] = [{ label: '1 slice', grams: 30 }];
    const options = buildServingOptions(100, 'g', custom);
    // Default should be prepended
    expect(options[0].isDefault).toBe(true);
    expect(options[0].label).toBe('100g');
  });

  it('does not prepend default when a custom option is already default', () => {
    const custom: ServingOption[] = [
      { label: '1 cup', grams: 240, isDefault: true },
    ];
    const options = buildServingOptions(100, 'g', custom);
    // First option should be the custom default, not "100g"
    expect(options[0].label).toBe('1 cup');
    expect(options[0].isDefault).toBe(true);
    // "100g" should NOT appear as a separate default entry
    expect(options.filter((o) => o.isDefault).length).toBe(1);
  });

  it('deduplicates universal options like 1 oz (regression: no duplicate labels)', () => {
    const options = buildServingOptions(100, 'g');
    const ozOptions = options.filter((o) => o.label === '1 oz');
    // After the bug fix, 1 oz should appear exactly once via deduplication
    expect(ozOptions).toHaveLength(1);
  });

  it('handles ml unit correctly', () => {
    const options = buildServingOptions(250, 'ml');
    expect(options[0].label).toBe('250ml');
    expect(options[0].grams).toBe(250);
  });

  it('handles oz unit correctly', () => {
    const options = buildServingOptions(28, 'oz');
    expect(options[0].label).toBe('28oz');
  });

  it('falls back to 100g when servingSize is zero', () => {
    const options = buildServingOptions(0, 'g');
    // Implementation uses 100g fallback for zero/negative servingSize
    expect(options[0].label).toBe('100g');
    expect(options[0].grams).toBe(100);
    expect(options[0].isDefault).toBe(true);
  });

  it('adds Custom (g) option when no existing gram-like label exists', () => {
    const options = buildServingOptions(100, 'g');
    expect(options.some((o) => o.label === 'Custom (g)')).toBe(true);
  });

  it('skips Custom (g) when a gram-like label already exists', () => {
    const custom: ServingOption[] = [
      { label: 'Per 50g)', grams: 50 }, // ends with "g)"
    ];
    const options = buildServingOptions(100, 'g', custom);
    // The check is: label === 'g' || label.endsWith('g)')
    // "Per 50g)" ends with "g)" so Custom (g) should be skipped
    expect(options.filter((o) => o.label === 'Custom (g)').length).toBe(0);
  });
});
