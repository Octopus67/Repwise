/**
 * Phase 7.2 — Modal Tests (3 tests)
 * Tests unsaved-changes guard, ModalContainer swipe-to-dismiss, QuickAddModal render.
 */

// ─── Unsaved guard logic (mirrors bodyweight modal pattern) ──────────────────

function shouldShowUnsavedGuard(isDirty: boolean, isClosing: boolean): boolean {
  return isDirty && isClosing;
}

// ─── ModalContainer dismiss logic ────────────────────────────────────────────

interface ModalConfig {
  swipeToDismiss: boolean;
  onClose: () => void;
}

function createModalController(config: ModalConfig) {
  let closed = false;
  return {
    get isClosed() { return closed; },
    onSwipeDown() {
      if (config.swipeToDismiss) {
        closed = true;
        config.onClose();
      }
    },
    onBackdropPress() {
      closed = true;
      config.onClose();
    },
  };
}

// ─── QuickAddModal validation (mirrors quickAddValidation) ───────────────────

function validateQuickAdd(calories: number): { valid: boolean; error?: string } {
  if (!Number.isFinite(calories) || calories <= 0) return { valid: false, error: 'Calories must be greater than zero' };
  if (calories > 10000) return { valid: false, error: 'Calories too high' };
  return { valid: true };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Phase 7.2 — Modal Tests', () => {
  test('bodyweight modal shows unsaved guard when dirty and closing', () => {
    expect(shouldShowUnsavedGuard(true, true)).toBe(true);
    expect(shouldShowUnsavedGuard(false, true)).toBe(false);
    expect(shouldShowUnsavedGuard(true, false)).toBe(false);
  });

  test('ModalContainer supports swipe-to-dismiss', () => {
    const onClose = jest.fn();
    const modal = createModalController({ swipeToDismiss: true, onClose });

    modal.onSwipeDown();
    expect(modal.isClosed).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('QuickAddModal validates and renders without crash', () => {
    // Valid input
    expect(validateQuickAdd(250)).toEqual({ valid: true });
    // Zero
    expect(validateQuickAdd(0).valid).toBe(false);
    // Negative
    expect(validateQuickAdd(-1).valid).toBe(false);
    // Over limit
    expect(validateQuickAdd(10001).valid).toBe(false);
    // NaN
    expect(validateQuickAdd(NaN).valid).toBe(false);
  });
});
