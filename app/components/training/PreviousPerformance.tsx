import { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { colors, spacing, typography } from '../../theme/tokens';
import { formatWeight } from '../../utils/unitConversion';
import { useStore } from '../../store';
import { useSkeletonPulse } from '../../hooks/useSkeletonPulse';
import api from '../../services/api';

interface PreviousPerformanceProps {
  exerciseName: string;
}

interface PreviousPerformanceData {
  exercise_name: string;
  session_date: string;
  last_set_weight_kg: number;
  last_set_reps: number;
}

export function PreviousPerformance({ exerciseName }: PreviousPerformanceProps) {
  const unitSystem = useStore((s) => s.unitSystem);
  const [data, setData] = useState<PreviousPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const pulseOpacity = useSkeletonPulse();

  const pulseStyle = pulseOpacity;

  // Fetch previous performance on mount / exercise change
  useEffect(() => {
    if (!exerciseName.trim()) return;

    let cancelled = false;
    setLoading(true);

    api
      .get(`training/previous-performance/${encodeURIComponent(exerciseName)}`)
      .then((res) => {
        if (!cancelled) setData(res.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [exerciseName]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Animated.Text style={[styles.skeleton, pulseStyle]}>
          Loading previous…
        </Animated.Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.container}>
        <Text style={styles.firstTime}>First time</Text>
      </View>
    );
  }

  const formatted = `Last time: ${formatWeight(data.last_set_weight_kg, unitSystem)} × ${data.last_set_reps}`;

  return (
    <View style={styles.container}>
      <Text style={styles.previousText}>{formatted}</Text>
    </View>
  );
}

/**
 * Pure formatting function for previous performance display.
 * Exported for property-based testing.
 */
export function formatPreviousPerformance(
  weightKg: number,
  reps: number,
  unitSystem: 'metric' | 'imperial',
): string {
  return `Last time: ${formatWeight(weightKg, unitSystem)} × ${reps}`;
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing[1],
    paddingBottom: spacing[1],
  },
  skeleton: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
  },
  firstTime: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    fontStyle: 'italic',
  },
  previousText: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
  },
});
