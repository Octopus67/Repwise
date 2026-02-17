import axios from 'axios';
import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1/`,
  timeout: 15_000,
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
  onRefreshFailed: () => void;
}) {
  getAccessToken = provider.getAccess;
  getRefreshToken = provider.getRefresh;
  onTokensRefreshed = provider.onRefreshed;
  onRefreshFailed = provider.onRefreshFailed;
}

// ─── Request interceptor — attach JWT ────────────────────────────────────────

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (getAccessToken) {
    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── Response interceptor — 401 → refresh → retry ───────────────────────────

let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processPendingQueue(token: string | null, error: unknown = null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else if (token) resolve(token);
  });
  pendingQueue = [];
}

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

    if (isRefreshing) {
      // Queue this request until the refresh completes
      return new Promise<string>((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((newToken) => {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) throw new Error('No refresh token');

      const { data } = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const newAccess: string = data.access_token;
      const newRefresh: string = data.refresh_token;

      await onTokensRefreshed(newAccess, newRefresh);

      originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      processPendingQueue(newAccess);

      return api(originalRequest);
    } catch (refreshError) {
      processPendingQueue(null, refreshError);
      onRefreshFailed?.();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
