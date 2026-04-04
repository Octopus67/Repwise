import axios from 'axios';
import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

const API_TIMEOUT_MS = 15_000;

const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1/`,
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Token provider ──────────────────────────────────────────────────────────

let getAccessToken: (() => Promise<string | null>) | null = null;
let getRefreshToken: (() => Promise<string | null>) | null = null;
let onTokensRefreshed: ((access: string, refresh: string) => Promise<void>) | null = null;
let onRefreshFailed: (() => void) | null = null;

/** Register token lifecycle callbacks once auth is initialized. */
export function setTokenProvider(provider: {
  getAccess: () => Promise<string | null>;
  getRefresh: () => Promise<string | null>;
  onRefreshed: (access: string, refresh: string) => Promise<void>;
  onRefreshFailed: () => void | Promise<void>;
}) {
  getAccessToken = provider.getAccess;
  getRefreshToken = provider.getRefresh;
  onTokensRefreshed = provider.onRefreshed;
  onRefreshFailed = provider.onRefreshFailed;
  proactiveRefreshFailed = false;
}

// ─── Request interceptor — attach JWT ────────────────────────────────────────

let proactiveRefreshFailed = false;

function getJwtExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch { return null; }
}

// ─── Shared refresh coordination ─────────────────────────────────────────────
// A single Promise coalesces all concurrent refresh attempts, eliminating the
// TOCTOU race that existed with the old boolean `isRefreshing` flag.

let refreshPromise: Promise<string> | null = null;

function doRefresh(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refresh = await getRefreshToken!();
    if (!refresh) throw new Error('No refresh token');

    const { data } = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
      refresh_token: refresh,
    });

    await onTokensRefreshed!(data.access_token, data.refresh_token);
    proactiveRefreshFailed = false;
    return data.access_token as string;
  })().catch((err) => {
    onRefreshFailed?.();
    throw err;
  }).finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (getAccessToken) {
    let token = await getAccessToken();
    // Proactive refresh: if token expires within 30s, refresh before attaching
    if (token && getRefreshToken && onTokensRefreshed && !proactiveRefreshFailed) {
      const exp = getJwtExp(token);
      if (exp && exp - Date.now() / 1000 < 30) {
        try {
          token = await doRefresh();
        } catch {
          console.warn('[api] Token refresh failed');
          proactiveRefreshFailed = true;
        }
      }
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── Response interceptor — 401 → refresh → retry ───────────────────────────

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (!getRefreshToken || !onTokensRefreshed) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const newAccess = await doRefresh();
      originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      return api(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

export default api;
