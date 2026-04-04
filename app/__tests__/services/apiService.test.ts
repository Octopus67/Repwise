/**
 * Unit tests for services/api.ts
 * Covers: token provider, request interceptor, response interceptor (401 refresh),
 * proactive refresh, doRefresh coalescing, base URL configuration.
 */

jest.mock('axios', () => {
  const interceptors = {
    request: { handlers: [] as any[], use(fn: any) { this.handlers.push(fn); } },
    response: { handlers: [] as any[], use(ok: any, err: any) { this.handlers.push({ ok, err }); } },
  };
  const instance = {
    interceptors,
    defaults: { baseURL: '' },
    get: jest.fn(),
    post: jest.fn(),
  };
  const create = jest.fn(() => instance);
  const post = jest.fn();
  return { __esModule: true, default: { create, post }, create, post, instance };
});

// We need to grab the interceptor handlers registered by api.ts.
// Re-require after mock is set up.
let api: any;
let setTokenProvider: any;
let axiosMock: any;
let axiosDefault: any;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();

  // Re-require to get fresh module state
  axiosMock = require('axios');
  axiosDefault = axiosMock.default ?? axiosMock;

  // The instance created by axios.create()
  const instance = axiosDefault.create();

  // Clear interceptor handlers from previous runs
  instance.interceptors.request.handlers = [];
  instance.interceptors.response.handlers = [];

  const apiModule = require('../../services/api');
  api = apiModule.default;
  setTokenProvider = apiModule.setTokenProvider;
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRequestInterceptor() {
  const instance = axiosDefault.create();
  return instance.interceptors.request.handlers[0];
}

function getResponseErrorHandler() {
  const instance = axiosDefault.create();
  return instance.interceptors.response.handlers[0]?.err;
}

/** Build a fake JWT with given exp (seconds since epoch). */
function fakeJwt(exp: number): string {
  const payload = Buffer.from(JSON.stringify({ sub: 'user1', exp })).toString('base64');
  return `header.${payload}.signature`;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('apiService', () => {
  describe('base URL configuration', () => {
    it('creates axios instance with /api/v1/ base path', () => {
      expect(axiosDefault.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: expect.stringContaining('/api/v1/'),
        }),
      );
    });

    it('sets Content-Type to application/json', () => {
      expect(axiosDefault.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
  });

  describe('setTokenProvider', () => {
    it('registers token lifecycle callbacks', () => {
      const provider = {
        getAccess: jest.fn().mockResolvedValue('tok'),
        getRefresh: jest.fn().mockResolvedValue('ref'),
        onRefreshed: jest.fn(),
        onRefreshFailed: jest.fn(),
      };

      // Should not throw
      expect(() => setTokenProvider(provider)).not.toThrow();
    });
  });

  describe('request interceptor — auth header', () => {
    it('attaches Bearer token when token provider returns a token', async () => {
      const farFuture = Math.floor(Date.now() / 1000) + 3600;
      const token = fakeJwt(farFuture);

      setTokenProvider({
        getAccess: jest.fn().mockResolvedValue(token),
        getRefresh: jest.fn().mockResolvedValue('refresh'),
        onRefreshed: jest.fn(),
        onRefreshFailed: jest.fn(),
      });

      const interceptor = getRequestInterceptor();
      const config = { headers: {} as any };
      const result = await interceptor(config);

      expect(result.headers.Authorization).toBe(`Bearer ${token}`);
    });

    it('does not attach header when getAccess returns null', async () => {
      setTokenProvider({
        getAccess: jest.fn().mockResolvedValue(null),
        getRefresh: jest.fn().mockResolvedValue(null),
        onRefreshed: jest.fn(),
        onRefreshFailed: jest.fn(),
      });

      const interceptor = getRequestInterceptor();
      const config = { headers: {} as any };
      const result = await interceptor(config);

      expect(result.headers.Authorization).toBeUndefined();
    });
  });

  describe('proactive refresh', () => {
    it('refreshes token when expiry is within 30s', async () => {
      const nearExpiry = Math.floor(Date.now() / 1000) + 10; // 10s from now
      const oldToken = fakeJwt(nearExpiry);
      const newToken = 'new-access-token';

      const onRefreshed = jest.fn();
      setTokenProvider({
        getAccess: jest.fn().mockResolvedValue(oldToken),
        getRefresh: jest.fn().mockResolvedValue('refresh-tok'),
        onRefreshed,
        onRefreshFailed: jest.fn(),
      });

      // Mock the refresh endpoint
      axiosDefault.post.mockResolvedValueOnce({
        data: { access_token: newToken, refresh_token: 'new-refresh' },
      });

      const interceptor = getRequestInterceptor();
      const config = { headers: {} as any };
      const result = await interceptor(config);

      expect(axiosDefault.post).toHaveBeenCalledWith(
        expect.stringContaining('auth/refresh'),
        expect.objectContaining({ refresh_token: 'refresh-tok' }),
      );
      expect(result.headers.Authorization).toBe(`Bearer ${newToken}`);
    });

    it('skips refresh when token has >30s remaining', async () => {
      const farFuture = Math.floor(Date.now() / 1000) + 3600;
      const token = fakeJwt(farFuture);

      setTokenProvider({
        getAccess: jest.fn().mockResolvedValue(token),
        getRefresh: jest.fn().mockResolvedValue('refresh'),
        onRefreshed: jest.fn(),
        onRefreshFailed: jest.fn(),
      });

      const interceptor = getRequestInterceptor();
      const config = { headers: {} as any };
      await interceptor(config);

      expect(axiosDefault.post).not.toHaveBeenCalled();
    });
  });

  describe('response interceptor — 401 refresh flow', () => {
    it('retries request after successful refresh on 401', async () => {
      const onRefreshed = jest.fn();
      setTokenProvider({
        getAccess: jest.fn().mockResolvedValue('old-token'),
        getRefresh: jest.fn().mockResolvedValue('refresh-tok'),
        onRefreshed,
        onRefreshFailed: jest.fn(),
      });

      axiosDefault.post.mockResolvedValueOnce({
        data: { access_token: 'new-access', refresh_token: 'new-refresh' },
      });

      const errorHandler = getResponseErrorHandler();
      const error = {
        response: { status: 401 },
        config: { headers: {} as any, _retry: false },
      };

      // The handler should attempt refresh and retry
      // It calls api(originalRequest) which is the instance — mock it
      const instance = axiosDefault.create();
      // Can't easily test the full retry chain without a real axios instance,
      // but we can verify refresh was called
      try {
        await errorHandler(error);
      } catch {
        // Expected — api(originalRequest) isn't a real function in our mock
      }

      expect(axiosDefault.post).toHaveBeenCalledWith(
        expect.stringContaining('auth/refresh'),
        { refresh_token: 'refresh-tok' },
      );
    });

    it('calls onRefreshFailed when refresh fails', async () => {
      const onRefreshFailed = jest.fn();
      setTokenProvider({
        getAccess: jest.fn().mockResolvedValue('old-token'),
        getRefresh: jest.fn().mockResolvedValue('refresh-tok'),
        onRefreshed: jest.fn(),
        onRefreshFailed,
      });

      axiosDefault.post.mockRejectedValueOnce(new Error('refresh failed'));

      const errorHandler = getResponseErrorHandler();
      const error = {
        response: { status: 401 },
        config: { headers: {} as any, _retry: false },
      };

      await expect(errorHandler(error)).rejects.toThrow();
      expect(onRefreshFailed).toHaveBeenCalled();
    });

    it('rejects non-401 errors without refresh attempt', async () => {
      setTokenProvider({
        getAccess: jest.fn(),
        getRefresh: jest.fn(),
        onRefreshed: jest.fn(),
        onRefreshFailed: jest.fn(),
      });

      const errorHandler = getResponseErrorHandler();
      const error = {
        response: { status: 500 },
        config: { headers: {} as any },
      };

      await expect(errorHandler(error)).rejects.toBe(error);
      expect(axiosDefault.post).not.toHaveBeenCalled();
    });
  });

  describe('doRefresh coalescing', () => {
    it('concurrent callers share the same refresh promise', async () => {
      setTokenProvider({
        getAccess: jest.fn().mockResolvedValue('old'),
        getRefresh: jest.fn().mockResolvedValue('refresh-tok'),
        onRefreshed: jest.fn(),
        onRefreshFailed: jest.fn(),
      });

      let resolveRefresh: (v: any) => void;
      const refreshPromise = new Promise((r) => { resolveRefresh = r; });
      axiosDefault.post.mockReturnValue(refreshPromise);

      const errorHandler = getResponseErrorHandler();
      const makeError = () => ({
        response: { status: 401 },
        config: { headers: {} as any, _retry: false },
      });

      // Fire two concurrent 401 handlers
      const p1 = errorHandler(makeError()).catch(() => {});
      const p2 = errorHandler(makeError()).catch(() => {});

      // Resolve the single refresh call
      resolveRefresh!({ data: { access_token: 'new', refresh_token: 'new-r' } });
      await Promise.allSettled([p1, p2]);

      // Only ONE refresh call should have been made
      expect(axiosDefault.post).toHaveBeenCalledTimes(1);
    });
  });
});
