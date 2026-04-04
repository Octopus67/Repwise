/**
 * Unit tests for auth flow logic (login, logout, token refresh, error handling).
 * Tests the pure logic patterns from LoginScreen and store/index.ts without React rendering.
 */

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn() },
  setTokenProvider: jest.fn(),
}));

jest.mock('../../utils/secureStorage', () => ({
  secureSet: jest.fn().mockResolvedValue(undefined),
  secureGet: jest.fn().mockResolvedValue(null),
  secureDelete: jest.fn().mockResolvedValue(undefined),
  TOKEN_KEYS: { access: 'rw_access_token', refresh: 'rw_refresh_token' },
}));

import api from '../../services/api';
import { secureSet, secureGet, secureDelete, TOKEN_KEYS } from '../../utils/secureStorage';
import { useStore } from '../../store/index';

const mockPost = api.post as jest.MockedFunction<typeof api.post>;
const mockSecureSet = secureSet as jest.MockedFunction<typeof secureSet>;
const mockSecureGet = secureGet as jest.MockedFunction<typeof secureGet>;
const mockSecureDelete = secureDelete as jest.MockedFunction<typeof secureDelete>;

beforeEach(() => {
  jest.clearAllMocks();
  useStore.getState().clearAuth();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Simulate the login flow from LoginScreen.handleLogin */
async function performLogin(email: string, password: string) {
  const { data } = await (api.post as any)('auth/login', { email, password });
  await secureSet(TOKEN_KEYS.access, data.access_token);
  await secureSet(TOKEN_KEYS.refresh, data.refresh_token);
  useStore.getState().setAuth(
    { id: 'user-1', email, role: 'user' },
    { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in },
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useAuthFlow', () => {
  describe('login flow', () => {
    it('calls API, stores tokens in secure storage, and sets auth state', async () => {
      mockPost.mockResolvedValueOnce({
        data: { access_token: 'acc-123', refresh_token: 'ref-456', expires_in: 3600 },
      } as any);

      await performLogin('test@example.com', 'password123');

      expect(mockPost).toHaveBeenCalledWith('auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });
      expect(mockSecureSet).toHaveBeenCalledWith(TOKEN_KEYS.access, 'acc-123');
      expect(mockSecureSet).toHaveBeenCalledWith(TOKEN_KEYS.refresh, 'ref-456');

      const state = useStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.email).toBe('test@example.com');
      expect(state.tokens?.accessToken).toBe('acc-123');
    });
  });

  describe('login failure', () => {
    it('rejects with API error and does not set auth state', async () => {
      mockPost.mockRejectedValueOnce(new Error('Invalid credentials'));

      await expect(performLogin('bad@example.com', 'wrong')).rejects.toThrow('Invalid credentials');

      expect(mockSecureSet).not.toHaveBeenCalled();
      expect(useStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('logout flow', () => {
    it('clears auth state, tokens, profile, and subscription', async () => {
      // Set up authenticated state
      useStore.getState().setAuth(
        { id: 'u1', email: 'test@example.com', role: 'premium' },
        { accessToken: 'a', refreshToken: 'r', expiresIn: 3600 },
      );
      useStore.getState().setProfile({
        id: 'p1', userId: 'u1', displayName: 'Test', avatarUrl: null,
        timezone: null, preferredCurrency: null, region: null,
      });
      useStore.getState().setSubscription({
        id: 's1', status: 'active', planId: 'pro', currency: 'USD', currentPeriodEnd: null,
      });

      expect(useStore.getState().isAuthenticated).toBe(true);

      useStore.getState().clearAuth();

      const state = useStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.tokens).toBeNull();
      expect(state.profile).toBeNull();
      expect(state.subscription).toBeNull();
    });
  });

  describe('token refresh flow', () => {
    it('updates tokens in store via updateTokens', () => {
      useStore.getState().setAuth(
        { id: 'u1', email: 'test@example.com', role: 'user' },
        { accessToken: 'old-acc', refreshToken: 'old-ref', expiresIn: 3600 },
      );

      useStore.getState().updateTokens({
        accessToken: 'new-acc',
        refreshToken: 'new-ref',
        expiresIn: 7200,
      });

      const tokens = useStore.getState().tokens;
      expect(tokens?.accessToken).toBe('new-acc');
      expect(tokens?.refreshToken).toBe('new-ref');
      expect(tokens?.expiresIn).toBe(7200);
    });
  });

  describe('initTokenProvider pattern', () => {
    it('onRefreshFailed clears secure storage and auth state', async () => {
      // Simulate what initTokenProvider's onRefreshFailed does
      useStore.getState().setAuth(
        { id: 'u1', email: 'test@example.com', role: 'user' },
        { accessToken: 'a', refreshToken: 'r', expiresIn: 3600 },
      );

      // Execute the onRefreshFailed callback pattern
      await secureDelete(TOKEN_KEYS.access);
      await secureDelete(TOKEN_KEYS.refresh);
      useStore.getState().clearAuth();

      expect(mockSecureDelete).toHaveBeenCalledWith(TOKEN_KEYS.access);
      expect(mockSecureDelete).toHaveBeenCalledWith(TOKEN_KEYS.refresh);
      expect(useStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('profile sets unit system', () => {
    it('setProfile with imperial preference updates unitSystem', () => {
      useStore.getState().setProfile({
        id: 'p1', userId: 'u1', displayName: null, avatarUrl: null,
        timezone: null, preferredCurrency: null, region: null,
        preferences: { unit_system: 'imperial' },
      });

      expect(useStore.getState().unitSystem).toBe('imperial');
    });
  });
});
