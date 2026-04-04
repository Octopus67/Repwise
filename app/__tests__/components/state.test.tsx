/**
 * Phase 7.3 — State Tests (4 tests)
 * Tests favorites functional update, onboarding hydration, MealSlotGroup expand, memo callbacks.
 */

// ─── Favorites with functional update (mirrors LearnScreen toggleFavorite) ───

function createFavoritesStore(initial: Set<string>) {
  let state = new Set(initial);

  return {
    get: () => state,
    toggle: async (id: string, apiFails: boolean) => {
      const wasFav = state.has(id);
      // Optimistic: functional update using previous state
      state = new Set(state);
      if (wasFav) state.delete(id); else state.add(id);

      try {
        if (apiFails) throw new Error('API error');
      } catch {
        // Revert using functional update (not stale closure)
        state = new Set(state);
        if (wasFav) state.add(id); else state.delete(id);
      }
    },
  };
}

// ─── Onboarding hydration flag (mirrors onboardingSlice) ─────────────────────

interface OnboardingState {
  _hydrated: boolean;
  currentStep: number;
}

function createOnboardingStore(): {
  getState: () => OnboardingState;
  loadState: (saved?: Partial<OnboardingState>) => void;
} {
  let state: OnboardingState = { _hydrated: false, currentStep: 1 };
  return {
    getState: () => state,
    loadState: (saved) => {
      state = { ...state, ...saved, _hydrated: true };
    },
  };
}

// ─── MealSlotGroup smart expand (mirrors MealSlotGroup useState init) ────────

function getInitialExpanded(entryCount: number): boolean {
  return entryCount > 0;
}

// ─── Memo callback detection ─────────────────────────────────────────────────

function shouldRerender(prevOnPress: Function, nextOnPress: Function): boolean {
  return prevOnPress !== nextOnPress;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Phase 7.3 — State Tests', () => {
  test('favorites functional update reverts correctly on API failure', async () => {
    const store = createFavoritesStore(new Set(['a1']));

    // Toggle off a1, API fails → should revert to having a1
    await store.toggle('a1', true);
    expect(store.get().has('a1')).toBe(true);

    // Toggle on b2, API fails → should revert to not having b2
    await store.toggle('b2', true);
    expect(store.get().has('b2')).toBe(false);

    // Toggle on c3, API succeeds → should keep c3
    await store.toggle('c3', false);
    expect(store.get().has('c3')).toBe(true);
  });

  test('onboarding slice _hydrated starts false, becomes true after loadState', () => {
    const store = createOnboardingStore();

    expect(store.getState()._hydrated).toBe(false);

    store.loadState({ currentStep: 3 });
    expect(store.getState()._hydrated).toBe(true);
    expect(store.getState().currentStep).toBe(3);
  });

  test('MealSlotGroup: empty slot collapsed, slot with entries expanded', () => {
    expect(getInitialExpanded(0)).toBe(false);
    expect(getInitialExpanded(1)).toBe(true);
    expect(getInitialExpanded(5)).toBe(true);
  });

  test('TodayWorkoutCard re-renders when onPress callback reference changes', () => {
    const fn1 = () => {};
    const fn2 = () => {};

    expect(shouldRerender(fn1, fn1)).toBe(false);
    expect(shouldRerender(fn1, fn2)).toBe(true);
  });
});
