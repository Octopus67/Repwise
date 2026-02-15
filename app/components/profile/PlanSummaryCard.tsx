import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';
import { Card } from '../common/Card';
import { Icon } from '../common/Icon';
import { Button } from '../common/Button';
import { formatSummaryFields } from '../../utils/editPlanLogic';

interface PlanSummaryCardProps {
  metrics: {
    id: string;
    heightCm: number | null;
    weightKg: number | null;
    bodyFatPct: number | null;
    activityLevel: string | null;
    recordedAt: string;
  } | null;
  goals: {
    id: string;
    userId: string;
    goalType: string;
    targetWeightKg: number | null;
    goalRatePerWeek: number | null;
  } | null;
  adaptiveTargets: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  } | null;
  unitSystem: 'metric' | 'imperial';
  onEdit: () => void;
}

const DASH = '—';

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.labelValue}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, value === DASH && styles.valueMuted]}>
        {value}
      </Text>
    </View>
  );
}

export function PlanSummaryCard({
  metrics,
  goals,
  adaptiveTargets,
  unitSystem,
  onEdit,
}: PlanSummaryCardProps) {
  const fields = formatSummaryFields(metrics, goals, adaptiveTargets, unitSystem);

  return (
    <Card>
      {/* Section header */}
      <View style={styles.header}>
        <Icon name="clipboard" size={20} color={colors.accent.primary} />
        <Text style={styles.sectionTitle}>My Plan</Text>
      </View>

      {/* Body stats row */}
      <View style={styles.row}>
        <LabelValue label="Weight" value={fields.weight} />
        <LabelValue label="Height" value={fields.height} />
        <LabelValue label="Body Fat" value={fields.bodyFat} />
        <LabelValue label="Activity" value={fields.activityLevel} />
      </View>

      {/* Goals row */}
      <View style={styles.row}>
        <LabelValue label="Goal" value={fields.goalType} />
        <LabelValue label="Target" value={fields.targetWeight} />
        <LabelValue label="Rate" value={fields.goalRate} />
      </View>

      {/* TDEE targets grid */}
      <View style={styles.divider} />
      <Text style={styles.targetsHeader}>TDEE Targets</Text>
      <View style={styles.targetsGrid}>
        <View style={styles.targetItem}>
          <Text style={[styles.targetValue, { color: colors.macro.calories }, fields.calories === DASH && styles.valueMuted]}>
            {fields.calories}
          </Text>
          <Text style={styles.targetLabel}>kcal</Text>
        </View>
        <View style={styles.targetItem}>
          <Text style={[styles.targetValue, { color: colors.macro.protein }, fields.protein === DASH && styles.valueMuted]}>
            {fields.protein}
          </Text>
          <Text style={styles.targetLabel}>protein</Text>
        </View>
        <View style={styles.targetItem}>
          <Text style={[styles.targetValue, { color: colors.macro.carbs }, fields.carbs === DASH && styles.valueMuted]}>
            {fields.carbs}
          </Text>
          <Text style={styles.targetLabel}>carbs</Text>
        </View>
        <View style={styles.targetItem}>
          <Text style={[styles.targetValue, { color: colors.macro.fat }, fields.fat === DASH && styles.valueMuted]}>
            {fields.fat}
          </Text>
          <Text style={styles.targetLabel}>fat</Text>
        </View>
      </View>

      {/* Edit CTA */}
      <View style={styles.buttonContainer}>
        <Button title="Edit My Plan" onPress={onEdit} variant="secondary" />
      </View>
    </Card>
  );
}


const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing[3],
  },
  labelValue: {
    minWidth: 80,
    flex: 1,
    marginBottom: spacing[1],
  },
  label: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[1],
  },
  value: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  valueMuted: {
    color: colors.text.muted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginBottom: spacing[3],
  },
  targetsHeader: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[3],
  },
  targetsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  targetItem: {
    alignItems: 'center',
    flex: 1,
  },
  targetValue: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    marginBottom: spacing[1],
  },
  targetLabel: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  buttonContainer: {
    marginTop: spacing[1],
  },
});
