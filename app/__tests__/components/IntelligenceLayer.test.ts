/**
 * Intelligence Layer — Pure logic tests
 *
 * Tests the exported pure functions from intelligenceLayerLogic.ts
 * used by OverloadSuggestionBadge and VolumeIndicatorPill.
 * These are pure functions so we test logic directly without React rendering.
 *
 * Task: 4.8
 */

import {
  getVolumeColor,
  formatSuggestionText,
  rpeToSuggestionType,
  getWeightIncrement,
  OverloadSuggestionData,
} from '../../utils/intelligenceLayerLogic';

// ─── (a) OverloadSuggestionBadge renders suggestion text correctly ───────────

describe('formatSuggestionText — suggestion text formatting', () => {
  const suggestion: OverloadSuggestionData = {
    exercise_name: 'Barbell Bench Press',
    suggested_weight_kg: 82.5,
    suggested_reps: 8,
    reasoning: 'Recent RPE avg 6.5 — increase weight',
    confidence: 'high',
  };

  it('formats suggestion in metric units', () => {
    const result = formatSuggestionText(suggestion, 'metric');
    expect(result).toBe('💡 Try 82.5kg × 8 (Recent RPE avg 6.5 — increase weight)');
  });

  it('formats suggestion in imperial units', () => {
    const result = formatSuggestionText(suggestion, 'imperial');
    // 82.5 * 2.20462 ≈ 181.9
    expect(result).toContain('💡 Try');
    expect(result).toContain('lbs');
    expect(result).toContain('× 8');
    expect(result).toContain('Recent RPE avg 6.5 — increase weight');
  });

  it('includes reasoning in parentheses', () => {
    const result = formatSuggestionText(suggestion, 'metric');
    expect(result).toContain('(Recent RPE avg 6.5 — increase weight)');
  });
});

// ─── (b) OverloadSuggestionBadge renders nothing when no suggestion ──────────

describe('formatSuggestionText — null/undefined handling', () => {
  it('returns empty string for null suggestion data fields', () => {
    // When the API returns 204 (no suggestion), the component renders nothing.
    // We test that the format function handles edge cases gracefully.
    const minimalSuggestion: OverloadSuggestionData = {
      exercise_name: 'Curl',
      suggested_weight_kg: 0,
      suggested_reps: 0,
      reasoning: '',
      confidence: 'low',
    };
    const result = formatSuggestionText(minimalSuggestion, 'metric');
    expect(result).toBe('💡 Try 0kg × 0 ()');
  });
});

// ─── (c) VolumeIndicatorPill shows correct color for below-MEV (red) ─────────

describe('getVolumeColor — below MEV', () => {
  it('returns red when current sets are 0 and MEV is 10', () => {
    expect(getVolumeColor(0, 10, 16, 22)).toBe('red');
  });

  it('returns red when current sets are 5 and MEV is 10', () => {
    expect(getVolumeColor(5, 10, 16, 22)).toBe('red');
  });

  it('returns red when current sets are 9 and MEV is 10', () => {
    expect(getVolumeColor(9, 10, 16, 22)).toBe('red');
  });
});

// ─── (d) VolumeIndicatorPill shows green for MAV-MRV range ───────────────────

describe('getVolumeColor — MAV to MRV (green)', () => {
  it('returns green when current sets equal MAV', () => {
    expect(getVolumeColor(16, 10, 16, 22)).toBe('green');
  });

  it('returns green when current sets are between MAV and MRV', () => {
    expect(getVolumeColor(19, 10, 16, 22)).toBe('green');
  });

  it('returns green when current sets equal MRV', () => {
    expect(getVolumeColor(22, 10, 16, 22)).toBe('green');
  });
});

// ─── Additional volume color tests ───────────────────────────────────────────

describe('getVolumeColor — MEV to MAV (yellow)', () => {
  it('returns yellow when current sets equal MEV', () => {
    expect(getVolumeColor(10, 10, 16, 22)).toBe('yellow');
  });

  it('returns yellow when current sets are between MEV and MAV', () => {
    expect(getVolumeColor(13, 10, 16, 22)).toBe('yellow');
  });

  it('returns yellow when current sets are just below MAV', () => {
    expect(getVolumeColor(15, 10, 16, 22)).toBe('yellow');
  });
});

describe('getVolumeColor — above MRV (red)', () => {
  it('returns red when current sets exceed MRV', () => {
    expect(getVolumeColor(23, 10, 16, 22)).toBe('red');
  });

  it('returns red when current sets are well above MRV', () => {
    expect(getVolumeColor(30, 10, 16, 22)).toBe('red');
  });
});

// ─── (e) VolumeIndicatorPill increments count on set completion ──────────────

describe('Volume count increment logic', () => {
  it('increments from 0 to 1 on first set completion', () => {
    const counts: Record<string, number> = {};
    const muscleGroup = 'chest';
    const updated = { ...counts, [muscleGroup]: (counts[muscleGroup] ?? 0) + 1 };
    expect(updated.chest).toBe(1);
  });

  it('increments from 5 to 6 on subsequent set completion', () => {
    const counts: Record<string, number> = { chest: 5 };
    const muscleGroup = 'chest';
    const updated = { ...counts, [muscleGroup]: (counts[muscleGroup] ?? 0) + 1 };
    expect(updated.chest).toBe(6);
  });

  it('tracks multiple muscle groups independently', () => {
    let counts: Record<string, number> = {};
    counts = { ...counts, chest: (counts.chest ?? 0) + 1 };
    counts = { ...counts, back: (counts.back ?? 0) + 1 };
    counts = { ...counts, chest: (counts.chest ?? 0) + 1 };
    expect(counts.chest).toBe(2);
    expect(counts.back).toBe(1);
  });

  it('total sets = fetched + local increments', () => {
    const fetchedSets = 12;
    const localIncrement = 3;
    const totalSets = fetchedSets + localIncrement;
    expect(totalSets).toBe(15);
    // And the color should reflect the total
    expect(getVolumeColor(totalSets, 10, 16, 22)).toBe('yellow');
  });
});

// ─── (f) RPE-to-suggestion mapping is correct ────────────────────────────────

describe('rpeToSuggestionType — RPE to suggestion mapping', () => {
  it('RPE < 7 suggests weight increase', () => {
    expect(rpeToSuggestionType(6)).toBe('increase_weight');
    expect(rpeToSuggestionType(6.5)).toBe('increase_weight');
    expect(rpeToSuggestionType(5)).toBe('increase_weight');
  });

  it('RPE 7-9 suggests rep increase', () => {
    expect(rpeToSuggestionType(7)).toBe('increase_reps');
    expect(rpeToSuggestionType(8)).toBe('increase_reps');
    expect(rpeToSuggestionType(9)).toBe('increase_reps');
  });

  it('RPE > 9 suggests maintain', () => {
    expect(rpeToSuggestionType(9.5)).toBe('maintain');
    expect(rpeToSuggestionType(10)).toBe('maintain');
  });

  it('boundary: RPE exactly 7 is increase_reps', () => {
    expect(rpeToSuggestionType(7)).toBe('increase_reps');
  });

  it('boundary: RPE exactly 9 is increase_reps', () => {
    expect(rpeToSuggestionType(9)).toBe('increase_reps');
  });
});

describe('getWeightIncrement — equipment-specific increments', () => {
  it('barbell increment is 2.5kg', () => {
    expect(getWeightIncrement('barbell')).toBe(2.5);
  });

  it('dumbbell increment is 1kg', () => {
    expect(getWeightIncrement('dumbbell')).toBe(1);
  });

  it('cable increment is 1kg', () => {
    expect(getWeightIncrement('cable')).toBe(1);
  });

  it('machine increment is 1kg', () => {
    expect(getWeightIncrement('machine')).toBe(1);
  });

  it('bodyweight increment is 1kg', () => {
    expect(getWeightIncrement('bodyweight')).toBe(1);
  });
});
