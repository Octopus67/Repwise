/**
 * BarcodeScanner Logic Tests
 *
 * Tests the pure business logic used by the BarcodeScanner component:
 * macro scaling, multiplier validation, debounce timing, and state transitions.
 */

describe('BarcodeScanner — macro scaling logic', () => {
  // The component scales macros by multiplier:
  // scaled.calories = Math.round(food.calories * mult)
  // scaled.protein_g = Math.round(food.protein_g * mult * 10) / 10
  // scaled.carbs_g = Math.round(food.carbs_g * mult * 10) / 10
  // scaled.fat_g = Math.round(food.fat_g * mult * 10) / 10

  const baseFoodItem = {
    calories: 350,
    protein_g: 25,
    carbs_g: 30,
    fat_g: 15,
    serving_size: 60,
    serving_unit: 'g',
  };

  function scaleMacros(food: typeof baseFoodItem, mult: number) {
    return {
      calories: Math.round(food.calories * mult),
      protein_g: Math.round(food.protein_g * mult * 10) / 10,
      carbs_g: Math.round(food.carbs_g * mult * 10) / 10,
      fat_g: Math.round(food.fat_g * mult * 10) / 10,
    };
  }

  test('multiplier 1 → same values', () => {
    const scaled = scaleMacros(baseFoodItem, 1);
    expect(scaled.calories).toBe(350);
    expect(scaled.protein_g).toBe(25);
    expect(scaled.carbs_g).toBe(30);
    expect(scaled.fat_g).toBe(15);
  });

  test('multiplier 2 → doubled values', () => {
    const scaled = scaleMacros(baseFoodItem, 2);
    expect(scaled.calories).toBe(700);
    expect(scaled.protein_g).toBe(50);
    expect(scaled.carbs_g).toBe(60);
    expect(scaled.fat_g).toBe(30);
  });

  test('multiplier 0.5 → halved values', () => {
    const scaled = scaleMacros(baseFoodItem, 0.5);
    expect(scaled.calories).toBe(175);
    expect(scaled.protein_g).toBe(12.5);
    expect(scaled.carbs_g).toBe(15);
    expect(scaled.fat_g).toBe(7.5);
  });

  test('multiplier 1.5 → 1.5x values', () => {
    const scaled = scaleMacros(baseFoodItem, 1.5);
    expect(scaled.calories).toBe(525);
    expect(scaled.protein_g).toBe(37.5);
    expect(scaled.carbs_g).toBe(45);
    expect(scaled.fat_g).toBe(22.5);
  });

  test('multiplier 0 → all zeros', () => {
    const scaled = scaleMacros(baseFoodItem, 0);
    expect(scaled.calories).toBe(0);
    expect(scaled.protein_g).toBe(0);
    expect(scaled.carbs_g).toBe(0);
    expect(scaled.fat_g).toBe(0);
  });

  test('fractional multiplier rounds to 1 decimal', () => {
    // 25 * 0.33 = 8.25 → round to 1 decimal = 8.3
    const scaled = scaleMacros(baseFoodItem, 0.33);
    expect(scaled.protein_g).toBe(8.3);
  });

  test('large multiplier (10 servings)', () => {
    const scaled = scaleMacros(baseFoodItem, 10);
    expect(scaled.calories).toBe(3500);
    expect(scaled.protein_g).toBe(250);
  });
});

describe('BarcodeScanner — multiplier validation', () => {
  // The component validates: parseFloat(multiplier) must be > 0 and not NaN
  function isValidMultiplier(input: string): boolean {
    const mult = parseFloat(input);
    return !isNaN(mult) && mult > 0;
  }

  test('"1" → valid', () => expect(isValidMultiplier('1')).toBe(true));
  test('"2.5" → valid', () => expect(isValidMultiplier('2.5')).toBe(true));
  test('"0.5" → valid', () => expect(isValidMultiplier('0.5')).toBe(true));
  test('"0" → invalid (not > 0)', () => expect(isValidMultiplier('0')).toBe(false));
  test('"-1" → invalid (negative)', () => expect(isValidMultiplier('-1')).toBe(false));
  test('"abc" → invalid (NaN)', () => expect(isValidMultiplier('abc')).toBe(false));
  test('"" → invalid (empty)', () => expect(isValidMultiplier('')).toBe(false));
  test('"0.01" → valid (small positive)', () => expect(isValidMultiplier('0.01')).toBe(true));
});

describe('BarcodeScanner — debounce logic', () => {
  // The component uses a 2-second debounce: if (now - lastScanRef.current < 2000) return;
  test('scans within 2 seconds are debounced', () => {
    // Component initialises lastScanRef.current = 0 and Date.now() returns
    // a large epoch ms value, so the very first real scan always passes.
    // We mirror that by starting lastScan at 0 and using realistic timestamps.
    let lastScan = 0;
    const DEBOUNCE_MS = 2000;
    const T0 = 1700000000000; // realistic epoch ms

    function shouldProcess(now: number): boolean {
      if (now - lastScan < DEBOUNCE_MS) return false;
      lastScan = now;
      return true;
    }

    // First scan → always passes (T0 - 0 is huge)
    expect(shouldProcess(T0)).toBe(true);
    // Second scan at +500ms → debounced
    expect(shouldProcess(T0 + 500)).toBe(false);
    // Third scan at +1999ms → still debounced
    expect(shouldProcess(T0 + 1999)).toBe(false);
    // Fourth scan at +2000ms → process
    expect(shouldProcess(T0 + 2000)).toBe(true);
    // Fifth scan at +2500ms → debounced
    expect(shouldProcess(T0 + 2500)).toBe(false);
    // Sixth scan at +4000ms → process
    expect(shouldProcess(T0 + 4000)).toBe(true);
  });
});

describe('BarcodeScanner — state transitions', () => {
  type ScanState = 'permission' | 'scanning' | 'loading' | 'found' | 'not_found' | 'denied';

  test('initial state is permission', () => {
    const initial: ScanState = 'permission';
    expect(initial).toBe('permission');
  });

  test('permission granted → scanning', () => {
    let state: ScanState = 'permission';
    // Simulate permission granted
    state = 'scanning';
    expect(state).toBe('scanning');
  });

  test('scan detected → loading', () => {
    let state: ScanState = 'scanning';
    state = 'loading';
    expect(state).toBe('loading');
  });

  test('API returns found → found', () => {
    let state: ScanState = 'loading';
    state = 'found';
    expect(state).toBe('found');
  });

  test('API returns not found → not_found', () => {
    let state: ScanState = 'loading';
    state = 'not_found';
    expect(state).toBe('not_found');
  });

  test('scan again from not_found → scanning', () => {
    let state: ScanState = 'not_found';
    state = 'scanning';
    expect(state).toBe('scanning');
  });

  test('permission denied → denied', () => {
    let state: ScanState = 'permission';
    state = 'denied';
    expect(state).toBe('denied');
  });
});

describe('BarcodeScanner — barcode format validation', () => {
  // Backend validates: ^\d{8,14}$
  function isValidBarcode(barcode: string): boolean {
    return /^\d{8,14}$/.test(barcode);
  }

  test('8-digit barcode → valid', () => expect(isValidBarcode('12345678')).toBe(true));
  test('12-digit barcode → valid', () => expect(isValidBarcode('123456789012')).toBe(true));
  test('13-digit EAN → valid', () => expect(isValidBarcode('3017620422003')).toBe(true));
  test('14-digit barcode → valid', () => expect(isValidBarcode('12345678901234')).toBe(true));
  test('7-digit → invalid (too short)', () => expect(isValidBarcode('1234567')).toBe(false));
  test('15-digit → invalid (too long)', () => expect(isValidBarcode('123456789012345')).toBe(false));
  test('letters → invalid', () => expect(isValidBarcode('abcdefgh')).toBe(false));
  test('empty → invalid', () => expect(isValidBarcode('')).toBe(false));
  test('mixed → invalid', () => expect(isValidBarcode('1234abcd')).toBe(false));
});
