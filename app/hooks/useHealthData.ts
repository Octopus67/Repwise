/**
 * Health data hook — platform-branched.
 * Gracefully returns null values when permissions denied or packages unavailable.
 *
 * NOTE: react-native-health (iOS) and expo-health-connect (Android) are not
 * currently installed. This hook returns stub data until those packages are
 * added to package.json. The original platform-specific fetch logic is
 * preserved below (commented out) for easy re-enablement.
 */

import { useEffect, useState } from 'react';

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
    // Health packages not installed — return stub data immediately.
    console.warn(
      '[useHealthData] react-native-health / expo-health-connect not installed. Returning stub data.',
    );
    setData(NULL_DATA);
  }, []);

  return data;
}

// ---------------------------------------------------------------------------
// Original platform fetch functions preserved for re-enablement.
// To restore: install the health packages, uncomment the code below,
// re-import Platform and getErrorMessage, and update useHealthData's useEffect
// to call fetchAndroid / fetchIOS based on Platform.OS.
// ---------------------------------------------------------------------------

/*
import { Platform } from 'react-native';
import { getErrorMessage } from '../utils/errors';

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
    } catch (err) { console.warn('[HealthData] HRV read failed:', String(err)); }

    try {
      const rhrRecords = await HC.readRecords('RestingHeartRate', { timeRangeFilter: { operatorType: 'between', ...timeRange } });
      if (rhrRecords?.records?.length > 0) {
        rhr = rhrRecords.records[rhrRecords.records.length - 1].beatsPerMinute;
      }
    } catch (err) { console.warn('[HealthData] RHR read failed:', String(err)); }

    try {
      const sleepRecords = await HC.readRecords('SleepSession', { timeRangeFilter: { operatorType: 'between', ...timeRange } });
      if (sleepRecords?.records?.length > 0) {
        const last = sleepRecords.records[sleepRecords.records.length - 1];
        const start = new Date(last.startTime).getTime();
        const end = new Date(last.endTime).getTime();
        sleep = (end - start) / (1000 * 60 * 60);
      }
    } catch (err) { console.warn('[HealthData] Sleep read failed:', String(err)); }

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

    AppleHealthKit.initHealthKit(permissions, (err: string | null) => {
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

      AppleHealthKit.getHeartRateVariabilitySamples(opts, (_e: string | null, results: { value: number }[]) => {
        if (results?.length > 0) hrv = results[results.length - 1].value * 1000;
        done();
      });

      AppleHealthKit.getRestingHeartRateSamples(opts, (_e: string | null, results: { value: number }[]) => {
        if (results?.length > 0) rhr = results[results.length - 1].value;
        done();
      });

      AppleHealthKit.getSleepSamples(opts, (_e: string | null, results: { startDate: string; endDate: string }[]) => {
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
*/
