import { useState, useEffect, useRef, useCallback } from 'react';
import { useFeatureFlag } from './useFeatureFlag';
import api from '../services/api';

interface RecoveryFactor {
  name: string;
  value: number;
  source: string;
}

interface RecoveryScore {
  score: number;
  volumeMultiplier: number;
  label: string;
  factors: RecoveryFactor[];
  isLoading: boolean;
  refresh: () => void;
}

/**
 * Fetches combined recovery score from /readiness/combined.
 * Caches for current session. Falls back to separate readiness when flag disabled.
 */
export function useRecoveryScore(): RecoveryScore {
  const { enabled: flagEnabled, loading: flagLoading } = useFeatureFlag('combined_readiness');
  const [state, setState] = useState<Omit<RecoveryScore, 'refresh'>>({
    score: 0, volumeMultiplier: 1.0, label: '', factors: [], isLoading: true,
  });
  const cachedRef = useRef(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    cachedRef.current = false;
    setState((s) => ({ ...s, isLoading: true }));
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (flagLoading || cachedRef.current) return;
    let cancelled = false;

    (async () => {
      if (flagEnabled) {
        try {
          const { data } = await api.get('readiness/combined');
          if (!cancelled) {
            cachedRef.current = true;
            setState({
              score: data.score,
              volumeMultiplier: data.volume_multiplier,
              label: data.label,
              factors: data.factors ?? [],
              isLoading: false,
            });
          }
          return;
        } catch {
          // Fall through to fallback
        }
      }

      // Fallback: use existing readiness score
      try {
        const { data } = await api.post('readiness/score', {});
        if (!cancelled) {
          cachedRef.current = true;
          setState({
            score: data.score ?? 0,
            volumeMultiplier: 1.0,
            label: data.score != null ? (data.score >= 70 ? 'Ready to Push' : data.score >= 40 ? 'Train Smart' : 'Recovery Day') : '',
            factors: (data.factors ?? []).map((f: any) => ({ name: f.name, value: f.normalized * 100, source: 'readiness' })),
            isLoading: false,
          });
        }
      } catch {
        if (!cancelled) setState((s) => ({ ...s, isLoading: false }));
      }
    })();

    return () => { cancelled = true; };
  }, [flagEnabled, flagLoading, refreshKey]);

  return { ...state, refresh };
}
