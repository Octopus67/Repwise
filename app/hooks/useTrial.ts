/**
 * useTrial — Hook for managing trial state across the app.
 */

import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import type { TrialStatus, TrialEligibility, TrialInsights } from '../utils/trialLogic';

export function useTrial() {
  const [status, setStatus] = useState<TrialStatus | null>(null);
  const [eligibility, setEligibility] = useState<TrialEligibility | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('trial/status');
      setStatus(res.data);
    } catch {
      // User may not have a trial
    }
  }, []);

  const fetchEligibility = useCallback(async () => {
    try {
      const res = await api.get('trial/eligibility');
      setEligibility(res.data);
    } catch (err) {
      console.warn('[Trial] eligibility fetch failed:', String(err));
    }
  }, []);

  const startTrial = useCallback(async () => {
    setLoading(true);
    try {
      await api.post('trial/start');
      await fetchStatus();
      await fetchEligibility();
    } finally {
      setLoading(false);
    }
  }, [fetchStatus, fetchEligibility]);

  const fetchInsights = useCallback(async (): Promise<TrialInsights | null> => {
    try {
      const res = await api.get('trial/insights');
      return res.data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchEligibility();
  }, [fetchStatus, fetchEligibility]);

  return {
    status,
    eligibility,
    loading,
    startTrial,
    fetchInsights,
    refresh: fetchStatus,
  };
}
