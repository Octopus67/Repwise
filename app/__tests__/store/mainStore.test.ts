/**
 * Unit tests for store/index.ts (main Zustand store)
 * Covers: auth actions, profile/unit system, subscription/premium check,
 * coaching mode, adaptive targets, date navigation, celebrations.
 */

import { useStore, isPremium } from '../../store/index';

function resetStore() {
  useStore.getState().clearAuth();
}

describe('useStore — main app store', () => {
  beforeEach(resetStore);

  // ── Auth ─────────────────────────────────────────────────────────────────

  describe('setAuth / clearAuth', () => {
    it('sets user, tokens, and isAuthenticated', () => {
      useStore.getState().setAuth(
        { id: 'u1', email: 'a@b.com', role: 'user' },
        { accessToken: 'a', refreshToken: 'r', expiresIn: 3600 },
      );
      const s = useStore.getState();
      expect(s.isAuthenticated).toBe(true);
      expect(s.user?.id).toBe('u1');
      expect(s.tokens?.accessToken).toBe('a');
    });

    it('clearAuth resets all auth-related state', () => {
      useStore.getState().setAuth(
        { id: 'u1', email: 'a@b.com', role: 'premium' },
        { accessToken: 'a', refreshToken: 'r', expiresIn: 3600 },
      );
      useStore.getState().setCoachingMode('collaborative');
      useStore.getState().setPendingCelebrations([
        { achievement_id: 'x', title: 't', description: 'd', icon: 'i', category: 'c' },
      ]);

      useStore.getState().clearAuth();

      const s = useStore.getState();
      expect(s.isAuthenticated).toBe(false);
      expect(s.user).toBeNull();
      expect(s.tokens).toBeNull();
      expect(s.profile).toBeNull();
      expect(s.subscription).toBeNull();
      expect(s.coachingMode).toBe('coached');
      expect(s.pendingCelebrations).toEqual([]);
    });
  });

  // ── Profile & Unit System ────────────────────────────────────────────────

  describe('setProfile', () => {
    it('derives unitSystem from profile preferences', () => {
      useStore.getState().setProfile({
        id: 'p1', userId: 'u1', displayName: null, avatarUrl: null,
        timezone: null, preferredCurrency: null, region: null,
        preferences: { unit_system: 'imperial' },
      });
      expect(useStore.getState().unitSystem).toBe('imperial');
    });

    it('defaults to metric when no unit preference', () => {
      useStore.getState().setProfile({
        id: 'p1', userId: 'u1', displayName: null, avatarUrl: null,
        timezone: null, preferredCurrency: null, region: null,
        preferences: null,
      });
      expect(useStore.getState().unitSystem).toBe('metric');
    });

    it('derives coachingMode from profile', () => {
      useStore.getState().setProfile({
        id: 'p1', userId: 'u1', displayName: null, avatarUrl: null,
        timezone: null, preferredCurrency: null, region: null,
        coachingMode: 'manual',
      });
      expect(useStore.getState().coachingMode).toBe('manual');
    });
  });

  // ── Subscription & Premium ───────────────────────────────────────────────

  describe('isPremium', () => {
    it('returns true for active subscription', () => {
      useStore.getState().setSubscription({
        id: 's1', status: 'active', planId: 'pro', currency: 'USD', currentPeriodEnd: null,
      });
      expect(isPremium(useStore.getState())).toBe(true);
    });

    it('returns true for past_due (grace period)', () => {
      useStore.getState().setSubscription({
        id: 's1', status: 'past_due', planId: 'pro', currency: null, currentPeriodEnd: null,
      });
      expect(isPremium(useStore.getState())).toBe(true);
    });

    it('returns false for free/cancelled', () => {
      useStore.getState().setSubscription({
        id: 's1', status: 'cancelled', planId: null, currency: null, currentPeriodEnd: null,
      });
      expect(isPremium(useStore.getState())).toBe(false);

      useStore.getState().setSubscription({
        id: 's2', status: 'free', planId: null, currency: null, currentPeriodEnd: null,
      });
      expect(isPremium(useStore.getState())).toBe(false);
    });

    it('returns false when no subscription', () => {
      expect(isPremium(useStore.getState())).toBe(false);
    });
  });

  // ── Adaptive Targets ────────────────────────────────────────────────────

  describe('setAdaptiveTargets', () => {
    it('stores and retrieves targets', () => {
      const targets = { calories: 2500, protein_g: 180, carbs_g: 300, fat_g: 80 };
      useStore.getState().setAdaptiveTargets(targets);
      expect(useStore.getState().adaptiveTargets).toEqual(targets);
    });

    it('can be cleared to null', () => {
      useStore.getState().setAdaptiveTargets({ calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 70 });
      useStore.getState().setAdaptiveTargets(null);
      expect(useStore.getState().adaptiveTargets).toBeNull();
    });
  });

  // ── Date Navigation ──────────────────────────────────────────────────────

  describe('setSelectedDate', () => {
    it('updates selected date', () => {
      useStore.getState().setSelectedDate('2024-06-15');
      expect(useStore.getState().selectedDate).toBe('2024-06-15');
    });
  });

  // ── RPE Mode ─────────────────────────────────────────────────────────────

  describe('setRpeMode', () => {
    it('toggles between rpe and rir', () => {
      useStore.getState().setRpeMode('rir');
      expect(useStore.getState().rpeMode).toBe('rir');
      useStore.getState().setRpeMode('rpe');
      expect(useStore.getState().rpeMode).toBe('rpe');
    });
  });

  // ── Celebrations ─────────────────────────────────────────────────────────

  describe('celebrations', () => {
    it('setPendingCelebrations and clearCelebrations', () => {
      const celebrations = [
        { achievement_id: 'a1', title: 'First Workout', description: 'd', icon: '🏋️', category: 'training' },
      ];
      useStore.getState().setPendingCelebrations(celebrations);
      expect(useStore.getState().pendingCelebrations).toHaveLength(1);

      useStore.getState().clearCelebrations();
      expect(useStore.getState().pendingCelebrations).toEqual([]);
    });
  });
});
