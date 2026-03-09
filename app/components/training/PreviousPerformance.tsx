import { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
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
  const c = useThemeColors();
  const styles = getThemedStyles(c);
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
        <Text style={[styles.firstTime, { color: c.text.muted }]}>First time</Text>
      </View>
    );
  }

  const formatted = `Last time: ${formatWeight(data.last_set_weight_kg, unitSystem)} × ${data.last_set_reps}`;

  return (
    <View style={styles.container}>
      <Text style={[styles.previousText, { color: c.text.secondary }]}>{formatted}</Text>
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

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    paddingTop: spacing[1],
    paddingBottom: spacing[1],
  },
  skeleton: {
    color: c.text.muted,
    fontSize: typography.size.xs,
  },
  firstTime: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    fontStyle: 'italic',
  },
  previousText: {
    color: c.text.secondary,
    fontSize: typography.size.xs,
  },
});
