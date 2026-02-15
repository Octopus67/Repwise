import { useState, useEffect, useRef } from 'react';
import { Text, StyleSheet, Platform } from 'react-native';
import { formatDuration } from '../../utils/durationFormat';
import { colors, typography } from '../../theme/tokens';

interface DurationTimerProps {
  startedAt: string; // ISO timestamp
}

/**
 * Displays elapsed workout time in HH:MM:SS format.
 * Recalculates from the start timestamp each tick so it survives backgrounding.
 */
export function DurationTimer({ startedAt }: DurationTimerProps) {
  const [elapsed, setElapsed] = useState(() => calcElapsed(startedAt));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Immediately sync on mount / startedAt change
    setElapsed(calcElapsed(startedAt));

    intervalRef.current = setInterval(() => {
      setElapsed(calcElapsed(startedAt));
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [startedAt]);

  return <Text style={styles.timer}>{formatDuration(elapsed)}</Text>;
}

function calcElapsed(startedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
}

const styles = StyleSheet.create({
  timer: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
