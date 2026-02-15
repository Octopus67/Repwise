/**
 * Health data hook — platform-branched.
 * Gracefully returns null values when permissions denied or packages unavailable.
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export interface HealthData {
  hrv_ms: number | null;
  resting_hr_bpm: number | null;
  sleep_duration_hours: number | null;
  permissionGranted: boolean;
  loading: boolean;
  error: string | null;
}

const NULL_DATA: HealthData = {
  hrv_ms: null,
  resting_hr_bpm: null,
  sleep_duration_hours: null,
  permissionGranted: false,
  loading: false,
  error: null,
};

export function useHealthData(): HealthData {
  const [data, setData] = useState<HealthData>({ ...NULL_DATA, loading: true });

  useEffect(() => {
    let cancelled = false;

    async function fetchHealthData() {
      try {
        if (Platform.OS === 'android') {
          await fetchAndroid(cancelled, setData);
        } else if (Platform.OS === 'ios') {
          await fetchIOS(cancelled, setData);
        } else {
          // Web or unsupported platform
          if (!cancelled) setData(NULL_DATA);
        }
      } catch (err: any) {
        if (!cancelled) {
          setData({ ...NULL_DATA, error: err?.message ?? 'Health data unavailable' });
        }
      }
    }

    fetchHealthData();
    return () => { cancelled = true; };
  }, []);

  return data;
}

async function fetchAndroid(
  cancelled: boolean,
  setData: (d: HealthData) => void,
) {
  try {
    const HC = require('expo-health-connect');
    const available = await HC.initialize();
    if (!available) {
      if (!cancelled) setData(NULL_DATA);
      return;
    }

    const granted = await HC.requestPermission([
      { accessType: 'read', recordType: 'HeartRateVariabilityRmssd' },
      { accessType: 'read', recordType: 'RestingHeartRate' },
      { accessType: 'read', recordType: 'SleepSession' },
    ]);

    if (!granted || granted.length === 0) {
      if (!cancelled) setData(NULL_DATA);
      return;
    }

    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const timeRange = { startTime: twoDaysAgo.toISOString(), endTime: now.toISOString() };

    let hrv: number | null = null;
    let rhr: number | null = null;
    let sleep: number | null = null;

    try {
      const hrvRecords = await HC.readRecords('HeartRateVariabilityRmssd', { timeRangeFilter: { operatorType: 'between', ...timeRange } });
      if (hrvRecords?.records?.length > 0) {
        hrv = hrvRecords.records[hrvRecords.records.length - 1].heartRateVariabilityMillis;
      }
    } catch {}

    try {
      const rhrRecords = await HC.readRecords('RestingHeartRate', { timeRangeFilter: { operatorType: 'between', ...timeRange } });
      if (rhrRecords?.records?.length > 0) {
        rhr = rhrRecords.records[rhrRecords.records.length - 1].beatsPerMinute;
      }
    } catch {}

    try {
      const sleepRecords = await HC.readRecords('SleepSession', { timeRangeFilter: { operatorType: 'between', ...timeRange } });
      if (sleepRecords?.records?.length > 0) {
        const last = sleepRecords.records[sleepRecords.records.length - 1];
        const start = new Date(last.startTime).getTime();
        const end = new Date(last.endTime).getTime();
        sleep = (end - start) / (1000 * 60 * 60);
      }
    } catch {}

    if (!cancelled) {
      setData({ hrv_ms: hrv, resting_hr_bpm: rhr, sleep_duration_hours: sleep, permissionGranted: true, loading: false, error: null });
    }
  } catch {
    if (!cancelled) setData(NULL_DATA);
  }
}

async function fetchIOS(
  cancelled: boolean,
  setData: (d: HealthData) => void,
) {
  try {
    const AppleHealthKit = require('react-native-health').default;
    const permissions = {
      permissions: {
        read: ['HeartRateVariability', 'RestingHeartRate', 'SleepAnalysis'],
      },
    };

    AppleHealthKit.initHealthKit(permissions, (err: any) => {
      if (err) {
        if (!cancelled) setData(NULL_DATA);
        return;
      }

      const opts = { startDate: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() };
      let hrv: number | null = null;
      let rhr: number | null = null;
      let sleep: number | null = null;
      let pending = 3;

      const done = () => {
        pending--;
        if (pending === 0 && !cancelled) {
          setData({ hrv_ms: hrv, resting_hr_bpm: rhr, sleep_duration_hours: sleep, permissionGranted: true, loading: false, error: null });
        }
      };

      AppleHealthKit.getHeartRateVariabilitySamples(opts, (_e: any, results: any[]) => {
        if (results?.length > 0) hrv = results[results.length - 1].value * 1000;
        done();
      });

      AppleHealthKit.getRestingHeartRateSamples(opts, (_e: any, results: any[]) => {
        if (results?.length > 0) rhr = results[results.length - 1].value;
        done();
      });

      AppleHealthKit.getSleepSamples(opts, (_e: any, results: any[]) => {
        if (results?.length > 0) {
          const last = results[results.length - 1];
          const start = new Date(last.startDate).getTime();
          const end = new Date(last.endDate).getTime();
          sleep = (end - start) / (1000 * 60 * 60);
        }
        done();
      });
    });
  } catch {
    if (!cancelled) setData(NULL_DATA);
  }
}
