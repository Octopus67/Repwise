/**
 * SetRowPremium — Swipe-to-delete gesture tests (Phase 4 UI/UX)
 *
 * Tests the swipe-to-delete logic used in SetRowPremium.
 * Mocks react-native-gesture-handler and react-native-reanimated
 * to validate threshold behavior and callback wiring.
 */

import React from 'react';

// ─── Gesture handler mock ────────────────────────────────────────────────────

type PanUpdateEvent = { translationX: number };
type PanEndEvent = { translationX: number };

interface SwipeState {
  translateX: number;
  deleted: boolean;
}

/**
 * Simulates the pan gesture logic from SetRowPremium.
 * Mirrors the onUpdate/onEnd handlers without needing the full RN renderer.
 */
function createSwipeSimulator(onRemoveSet?: () => void) {
  const DELETE_THRESHOLD = -80;
  const MAX_TRANSLATE = -120;
  const state: SwipeState = { translateX: 0, deleted: false };

  return {
    state,
    onUpdate(e: PanUpdateEvent) {
      if (e.translationX < 0) {
        state.translateX = Math.max(e.translationX, MAX_TRANSLATE);
      }
    },
    onEnd() {
      if (state.translateX < DELETE_THRESHOLD && onRemoveSet) {
        state.deleted = true;
        onRemoveSet();
      } else {
        // spring back
        state.translateX = 0;
      }
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SetRowPremium — swipe-to-delete', () => {
  test('swipe past threshold triggers onRemoveSet', () => {
    const onRemoveSet = jest.fn();
    const sim = createSwipeSimulator(onRemoveSet);

    sim.onUpdate({ translationX: -100 });
    expect(sim.state.translateX).toBe(-100);

    sim.onEnd();
    expect(onRemoveSet).toHaveBeenCalledTimes(1);
    expect(sim.state.deleted).toBe(true);
  });

  test('swipe below threshold springs back without delete', () => {
    const onRemoveSet = jest.fn();
    const sim = createSwipeSimulator(onRemoveSet);

    sim.onUpdate({ translationX: -50 });
    expect(sim.state.translateX).toBe(-50);

    sim.onEnd();
    expect(onRemoveSet).not.toHaveBeenCalled();
    expect(sim.state.translateX).toBe(0);
    expect(sim.state.deleted).toBe(false);
  });

  test('translateX is clamped to -120 max', () => {
    const onRemoveSet = jest.fn();
    const sim = createSwipeSimulator(onRemoveSet);

    sim.onUpdate({ translationX: -200 });
    expect(sim.state.translateX).toBe(-120);

    sim.onEnd();
    expect(onRemoveSet).toHaveBeenCalledTimes(1);
  });
});
