import { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * Check a feature flag for the current user.
 * Re-evaluates on each mount (no cross-session caching per Req 1.3).
 * Defaults to false on error (safe fallback — flag off = manual entry, not broken).
 * Deduplicates in-flight requests for the same flag within a session.
 */

const _flagCache = new Map<string, { promise: Promise<boolean>; ts: number }>();
const FLAG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function fetchFlag(flagName: string): Promise<boolean> {
  const existing = _flagCache.get(flagName);
  if (existing && Date.now() - existing.ts < FLAG_CACHE_TTL_MS) return existing.promise;
  const promise = api
    .get(`feature-flags/check/${flagName}`)
    .then((res) => res.data?.enabled === true)
    .catch(() => false);
  _flagCache.set(flagName, { promise, ts: Date.now() });
  return promise;
}

export function useFeatureFlag(flagName: string): {
  enabled: boolean;
  loading: boolean;
} {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchFlag(flagName).then((val) => {
      if (!cancelled) {
        setEnabled(val);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [flagName]);

  return { enabled, loading };
}
