import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Card } from '../common/Card';
import { Icon } from '../common/Icon';

interface Classification {
  exercise_name: string;
  e1rm_kg: number;
  bodyweight_kg: number;
  bodyweight_ratio: number;
  level: string;
  next_level: string | null;
  next_level_threshold_kg: number | null;
}

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

function formatExerciseName(name: string): string {
  return name.split(' ').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

export function StrengthLeaderboard({ classifications }: StrengthLeaderboardProps) {
  // Separate lifts with data from those without
  const withData = [...classifications].sort((a, b) => b.bodyweight_ratio - a.bodyweight_ratio);
  const withDataNames = new Set(withData.map((c) => c.exercise_name.toLowerCase()));
  const noData = SUPPORTED_LIFTS.filter((l) => !withDataNames.has(l));

  if (withData.length === 0) {
    return (
      <Card>
        <View style={styles.emptyContainer}>
          <Icon name="chart" size={24} color={colors.text.muted} />
          <Text style={styles.emptyText}>No strength data yet</Text>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      {withData.map((c, idx) => {
        const isStrongest = idx === 0 && withData.length >= 2;
        const isWeakest = idx === withData.length - 1 && withData.length >= 2;
        const highlightColor = isStrongest
          ? colors.accent.primary
          : isWeakest
            ? colors.semantic.warning
            : undefined;

        return (
          <View key={c.exercise_name} style={[styles.row, idx > 0 && styles.rowBorder]}>
            <View style={styles.rankCol}>
              <Text style={[styles.rank, highlightColor ? { color: highlightColor } : undefined]}>
                #{idx + 1}
              </Text>
            </View>
            <View style={styles.nameCol}>
              <Text style={[styles.exerciseName, highlightColor ? { color: highlightColor } : undefined]}>
                {formatExerciseName(c.exercise_name)}
              </Text>
              <Text style={styles.level}>
                {c.level.charAt(0).toUpperCase() + c.level.slice(1)}
              </Text>
            </View>
            <View style={styles.statsCol}>
              <Text style={styles.e1rm}>{Math.round(c.e1rm_kg)} kg</Text>
              <Text style={styles.ratio}>{c.bodyweight_ratio.toFixed(2)}×</Text>
            </View>
          </View>
        );
      })}

      {/* No data lifts at bottom */}
      {noData.map((lift) => (
        <View key={lift} style={[styles.row, styles.rowBorder]}>
          <View style={styles.rankCol}>
            <Text style={styles.rankMuted}>—</Text>
          </View>
          <View style={styles.nameCol}>
            <Text style={styles.exerciseNameMuted}>{formatExerciseName(lift)}</Text>
          </View>
          <View style={styles.statsCol}>
            <Text style={styles.noData}>No data</Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
  },
  emptyText: {
    color: colors.text.muted,
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
    borderTopColor: colors.border.subtle,
  },
  rankCol: { width: 32 },
  rank: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  rankMuted: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
  },
  nameCol: { flex: 1 },
  exerciseName: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  exerciseNameMuted: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
  },
  level: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
    marginTop: 1,
  },
  statsCol: { alignItems: 'flex-end' },
  e1rm: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  ratio: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
    marginTop: 1,
  },
  noData: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    fontStyle: 'italic',
  },
});
