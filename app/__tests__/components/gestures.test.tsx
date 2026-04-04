/**
 * Phase 7.1 — Gesture Tests (3 tests)
 * Tests swipe-to-delete animation, snap-back, and exercise picker custom item.
 */

// ─── Swipe simulator (mirrors SetRowPremium gesture logic) ───────────────────

const DELETE_THRESHOLD = -80;
const DELETE_TRANSLATE = -300;
const MAX_TRANSLATE = -120;

interface SwipeState {
  translateX: number;
  deleted: boolean;
}

function createSwipeSimulator(onRemoveSet?: () => void) {
  const state: SwipeState = { translateX: 0, deleted: false };

  return {
    state,
    onUpdate(translationX: number) {
      if (translationX < 0) {
        state.translateX = Math.max(translationX, MAX_TRANSLATE);
      }
    },
    onEnd() {
      if (state.translateX < DELETE_THRESHOLD && onRemoveSet) {
        state.translateX = DELETE_TRANSLATE; // animate off-screen
        state.deleted = true;
        onRemoveSet();
      } else {
        state.translateX = 0; // snap back
      }
    },
  };
}

// ─── Exercise picker "Add custom" logic ──────────────────────────────────────

interface PickerItem {
  name: string;
  isCustom?: boolean;
}

function getPickerResults(exercises: string[], query: string): PickerItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return exercises.map((name) => ({ name }));
  const matches = exercises.filter((e) => e.toLowerCase().includes(q));
  const exactMatch = exercises.some((e) => e.toLowerCase() === q);
  if (!exactMatch && q.length > 0) {
    matches.push({ name: query.trim(), isCustom: true } as any);
  }
  return matches.map((m) => (typeof m === 'string' ? { name: m } : m));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Phase 7.1 — Gesture Tests', () => {
  test('swipe past threshold animates translateX to -300 and calls onRemoveSet', () => {
    const onRemoveSet = jest.fn();
    const sim = createSwipeSimulator(onRemoveSet);

    sim.onUpdate(-100);
    sim.onEnd();

    expect(sim.state.translateX).toBe(DELETE_TRANSLATE);
    expect(sim.state.deleted).toBe(true);
    expect(onRemoveSet).toHaveBeenCalledTimes(1);
  });

  test('swipe below threshold snaps back to 0', () => {
    const onRemoveSet = jest.fn();
    const sim = createSwipeSimulator(onRemoveSet);

    sim.onUpdate(-50);
    sim.onEnd();

    expect(sim.state.translateX).toBe(0);
    expect(sim.state.deleted).toBe(false);
    expect(onRemoveSet).not.toHaveBeenCalled();
  });

  test('exercise picker shows "+ Add" row for non-existent exercise', () => {
    const exercises = ['Bench Press', 'Squat', 'Deadlift'];
    const results = getPickerResults(exercises, 'Zercher Squat');

    const customItem = results.find((r) => r.isCustom);
    expect(customItem).toBeDefined();
    expect(customItem!.name).toBe('Zercher Squat');
  });
});
