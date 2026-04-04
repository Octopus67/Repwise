import { View, Text, StyleSheet } from 'react-native';
import { radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Card } from '../common/Card';
import { Icon } from '../common/Icon';
import type { Classification } from '../../types/analytics';
import { formatExerciseName } from '../../utils/formatting';

// All 5 supported lifts
const SUPPORTED_LIFTS = [
  'barbell bench press',
  'barbell back squat',
  'conventional deadlift',
  'overhead press',
  'barbell row',
];

interface StrengthLeaderboardProps {
  classifications: Classification[];
}

export function StrengthLeaderboard({ classifications }: StrengthLeaderboardProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  // Separate lifts with data from those without
  const withData = [...classifications].sort((a, b) => b.bodyweight_ratio - a.bodyweight_ratio);
  const withDataNames = new Set(withData.map((d) => d.exercise_name.toLowerCase()));
  const noData = SUPPORTED_LIFTS.filter((l) => !withDataNames.has(l));

  if (withData.length === 0) {
    return (
      <Card>
        <View style={styles.emptyContainer}>
          <Icon name="chart" size={24} color={c.text.muted} />
          <Text style={[styles.emptyText, { color: c.text.muted }]}>No strength data yet</Text>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      {withData.map((item, idx) => {
        const isStrongest = idx === 0 && withData.length >= 2;
        const isWeakest = idx === withData.length - 1 && withData.length >= 2;
        const highlightColor = isStrongest
          ? c.accent.primary
          : isWeakest
            ? c.semantic.warning
            : undefined;

        return (
          <View key={item.exercise_name} style={[styles.row, idx > 0 && styles.rowBorder]}>
            <View style={styles.rankCol}>
              <Text style={[styles.rank, highlightColor ? { color: highlightColor } : undefined]}>
                #{idx + 1}
              </Text>
            </View>
            <View style={styles.nameCol}>
              <Text style={[styles.exerciseName, highlightColor ? { color: highlightColor } : undefined]}>
                {formatExerciseName(item.exercise_name)}
              </Text>
              <Text style={[styles.level, { color: c.text.secondary }]}>
                {item.level.charAt(0).toUpperCase() + item.level.slice(1)}
              </Text>
            </View>
            <View style={styles.statsCol}>
              <Text style={[styles.e1rm, { color: c.text.primary }]}>{Math.round(item.e1rm_kg)} kg</Text>
              <Text style={[styles.ratio, { color: c.text.secondary }]}>{item.bodyweight_ratio.toFixed(2)}×</Text>
            </View>
          </View>
        );
      })}

      {/* No data lifts at bottom */}
      {noData.map((lift) => (
        <View key={lift} style={[styles.row, styles.rowBorder]}>
          <View style={styles.rankCol}>
            <Text style={[styles.rankMuted, { color: c.text.muted }]}>—</Text>
          </View>
          <View style={styles.nameCol}>
            <Text style={[styles.exerciseNameMuted, { color: c.text.muted }]}>{formatExerciseName(lift)}</Text>
          </View>
          <View style={styles.statsCol}>
            <Text style={[styles.noData, { color: c.text.muted }]}>No data</Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  emptyContainer: {
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
  },
  emptyText: {
    color: c.text.muted,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: c.border.subtle,
  },
  rankCol: { width: 32 },
  rank: {
    color: c.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  rankMuted: {
    color: c.text.muted,
    fontSize: typography.size.sm,
  },
  nameCol: { flex: 1 },
  exerciseName: {
    color: c.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  exerciseNameMuted: {
    color: c.text.muted,
    fontSize: typography.size.sm,
  },
  level: {
    color: c.text.secondary,
    fontSize: typography.size.xs,
    marginTop: 1,
  },
  statsCol: { alignItems: 'flex-end' },
  e1rm: {
    color: c.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  ratio: {
    color: c.text.secondary,
    fontSize: typography.size.xs,
    marginTop: 1,
  },
  noData: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    fontStyle: 'italic',
  },
});
