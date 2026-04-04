import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { getApiErrorMessage } from '../utils/errors';
import type { WNSWeeklyResponse } from '../types/volume';

interface UseWNSVolumeResult {
  data: WNSWeeklyResponse | null;
  isWNS: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches weekly volume data and detects whether the WNS engine is active.
 * When the backend returns engine='wns', the response includes HU data.
 * When engine='legacy', the response has the old effective_sets format.
 */
export function useWNSVolume(weekStart: string, refreshKey?: string | number): UseWNSVolumeResult {
  const [data, setData] = useState<WNSWeeklyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVolume = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('training/analytics/muscle-volume', {
        params: { week_start: weekStart },
      });
      setData(res.data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load volume data'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [weekStart, refreshKey]);

  useEffect(() => {
    fetchVolume();
  }, [fetchVolume]);

  return {
    data,
    isWNS: data?.engine === 'wns',
    loading,
    error,
    refetch: fetchVolume,
  };
}
