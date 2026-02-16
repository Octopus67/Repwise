/**
 * ExerciseDetailSheet — Pure logic tests
 *
 * Tests the exported helper functions from exerciseDetailLogic.ts
 * used by ExerciseDetailSheet. These are pure functions so we test
 * logic directly without React rendering.
 *
 * Phase 5, Task 5.5
 */

import {
  shouldShowInstructions,
  shouldShowTips,
  shouldShowImage,
  getDisplayImageUrl,
  getMusclesTargeted,
  getExerciseTags,
} from '../../utils/exerciseDetailLogic';
import type { Exercise } from '../../types/exercise';

// ─── Test fixtures ───────────────────────────────────────────────────────────

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'barbell-bench-press',
    name: 'Barbell Bench Press',
    muscle_group: 'chest',
    secondary_muscles: ['triceps', 'shoulders'],
    equipment: 'barbell',
    category: 'compound',
    image_url: 'https://cdn.example.com/bench-press.svg',
    animation_url: 'https://cdn.example.com/bench-press.gif',
    description: 'A compound pressing movement',
    instructions: [
      'Lie flat on a bench with feet on the floor',
      'Grip the bar slightly wider than shoulder width',
      'Unrack and lower to mid-chest',
      'Press up to full lockout',
    ],
    tips: [
      'Keep shoulder blades retracted and depressed',
      'Drive feet into the floor for leg drive',
    ],
    ...overrides,
  };
}

// ─── (a) renders instructions when available ─────────────────────────────────

describe('shouldShowInstructions — instructions available', () => {
  it('returns true when instructions is a non-empty array', () => {
    const ex = makeExercise();
    expect(shouldShowInstructions(ex)).toBe(true);
  });

  it('returns true for single instruction', () => {
    const ex = makeExercise({ instructions: ['Step one'] });
    expect(shouldShowInstructions(ex)).toBe(true);
  });
});

// ─── (b) renders "No instructions available" when instructions is null ───────

describe('shouldShowInstructions — no instructions', () => {
  it('returns false when instructions is null', () => {
    const ex = makeExercise({ instructions: null });
    expect(shouldShowInstructions(ex)).toBe(false);
  });

  it('returns false when instructions is empty array', () => {
    const ex = makeExercise({ instructions: [] });
    expect(shouldShowInstructions(ex)).toBe(false);
  });
});

// ─── (c) renders primary and secondary muscles ──────────────────────────────

describe('getMusclesTargeted — primary and secondary muscles', () => {
  it('returns primary muscle group', () => {
    const ex = makeExercise();
    const muscles = getMusclesTargeted(ex);
    expect(muscles.primary).toBe('chest');
  });

  it('returns secondary muscles array', () => {
    const ex = makeExercise();
    const muscles = getMusclesTargeted(ex);
    expect(muscles.secondary).toEqual(['triceps', 'shoulders']);
  });

  it('returns empty secondary when no secondary muscles', () => {
    const ex = makeExercise({ secondary_muscles: [] });
    const muscles = getMusclesTargeted(ex);
    expect(muscles.secondary).toEqual([]);
  });

  it('handles undefined secondary_muscles gracefully', () => {
    const ex = makeExercise({ secondary_muscles: undefined as any });
    const muscles = getMusclesTargeted(ex);
    expect(muscles.secondary).toEqual([]);
  });
});

// ─── (d) renders image when image_url present ────────────────────────────────

describe('shouldShowImage — image available', () => {
  it('returns true when image_url is present', () => {
    const ex = makeExercise({ animation_url: null });
    expect(shouldShowImage(ex)).toBe(true);
  });

  it('returns true when animation_url is present', () => {
    const ex = makeExercise({ image_url: null });
    expect(shouldShowImage(ex)).toBe(true);
  });

  it('returns true when both image_url and animation_url are present', () => {
    const ex = makeExercise();
    expect(shouldShowImage(ex)).toBe(true);
  });

  it('prefers animation_url over image_url for display', () => {
    const ex = makeExercise();
    expect(getDisplayImageUrl(ex)).toBe('https://cdn.example.com/bench-press.gif');
  });

  it('falls back to image_url when animation_url is null', () => {
    const ex = makeExercise({ animation_url: null });
    expect(getDisplayImageUrl(ex)).toBe('https://cdn.example.com/bench-press.svg');
  });
});

// ─── (e) renders placeholder when no image ───────────────────────────────────

describe('shouldShowImage — no image', () => {
  it('returns false when both image_url and animation_url are null', () => {
    const ex = makeExercise({ image_url: null, animation_url: null });
    expect(shouldShowImage(ex)).toBe(false);
  });

  it('returns false when both are empty strings', () => {
    const ex = makeExercise({ image_url: '', animation_url: '' });
    expect(shouldShowImage(ex)).toBe(false);
  });

  it('getDisplayImageUrl returns null when no images', () => {
    const ex = makeExercise({ image_url: null, animation_url: null });
    expect(getDisplayImageUrl(ex)).toBeNull();
  });
});

// ─── Additional: shouldShowTips ──────────────────────────────────────────────

describe('shouldShowTips', () => {
  it('returns true when tips is a non-empty array', () => {
    const ex = makeExercise();
    expect(shouldShowTips(ex)).toBe(true);
  });

  it('returns false when tips is null', () => {
    const ex = makeExercise({ tips: null });
    expect(shouldShowTips(ex)).toBe(false);
  });

  it('returns false when tips is empty array', () => {
    const ex = makeExercise({ tips: [] });
    expect(shouldShowTips(ex)).toBe(false);
  });
});

// ─── Additional: getExerciseTags ─────────────────────────────────────────────

describe('getExerciseTags', () => {
  it('returns muscle group, equipment, and category tags', () => {
    const ex = makeExercise();
    const tags = getExerciseTags(ex);
    expect(tags).toEqual(['chest', 'barbell', 'compound']);
  });

  it('replaces underscores with spaces in tags', () => {
    const ex = makeExercise({ muscle_group: 'full_body', equipment: 'smith_machine' });
    const tags = getExerciseTags(ex);
    expect(tags[0]).toBe('full body');
    expect(tags[1]).toBe('smith machine');
  });
});
