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

interface StrengthStandardsCardProps {
  classifications: Classification[];
  bodyweightKg: number | null;
}

const LEVEL_COLORS: Record<string, string> = {
  beginner: colors.text.muted,
  intermediate: colors.semantic.warning,
  advanced: colors.accent.primary,
  elite: colors.premium.gold,
};

function formatExerciseName(name: string): string {
  return name.split(' ').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function LevelBadge({ level }: { level: string }) {
  const color = LEVEL_COLORS[level] ?? colors.text.muted;
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </Text>
    </View>
  );
}

export function StrengthStandardsCard({ classifications, bodyweightKg }: StrengthStandardsCardProps) {
  if (bodyweightKg == null) {
    return (
      <Card>
        <View style={styles.emptyContainer}>
          <Icon name="scale" size={24} color={colors.text.muted} />
          <Text style={styles.emptyText}>Log your bodyweight to see strength standards</Text>
        </View>
      </Card>
    );
  }

  if (classifications.length === 0) {
    return (
      <Card>
        <View style={styles.emptyContainer}>
          <Icon name="dumbbell" size={24} color={colors.text.muted} />
          <Text style={styles.emptyText}>Log training sessions with supported lifts to see standards</Text>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      {classifications.map((c, idx) => (
        <View key={c.exercise_name} style={[styles.row, idx > 0 && styles.rowBorder]}>
          <View style={styles.rowLeft}>
            <Text style={styles.exerciseName}>{formatExerciseName(c.exercise_name)}</Text>
            <Text style={styles.ratio}>{c.bodyweight_ratio.toFixed(2)}× BW</Text>
          </View>
          <View style={styles.rowRight}>
            <LevelBadge level={c.level} />
            <Text style={styles.e1rm}>{Math.round(c.e1rm_kg)} kg</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  rowLeft: { flex: 1 },
  rowRight: { alignItems: 'flex-end', gap: spacing[1] },
  exerciseName: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  ratio: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
    marginTop: 2,
  },
  e1rm: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
  },
  badge: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
});
