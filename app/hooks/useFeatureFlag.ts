import { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * Check a feature flag for the current user.
 * Re-evaluates on each mount (no cross-session caching per Req 1.3).
 * Defaults to false on error (safe fallback — flag off = manual entry, not broken).
 */
export function useFeatureFlag(flagName: string): {
  enabled: boolean;
  loading: boolean;
} {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`feature-flags/check/${flagName}`);
        if (!cancelled) setEnabled(res.data?.enabled === true);
      } catch {
        if (!cancelled) setEnabled(false); // safe fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [flagName]);

  return { enabled, loading };
}
