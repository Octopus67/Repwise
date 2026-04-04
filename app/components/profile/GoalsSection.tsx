import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { radius, spacing, typography, letterSpacing } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Card } from '../common/Card';
import { EditableField } from '../common/EditableField';
import { EmptyState } from '../common/EmptyState';
import { Icon } from '../common/Icon';
import { formatWeight, parseWeightInput } from '../../utils/unitConversion';
import { useRecalculate } from '../../hooks/useRecalculate';
import type { GoalType } from '../../types/onboarding';

const GOAL_TYPES: { value: GoalType; label: string }[] = [
  { value: 'cutting', label: 'Cutting' },
  { value: 'maintaining', label: 'Maintaining' },
  { value: 'bulking', label: 'Bulking' },
  { value: 'recomposition', label: 'Body Recomposition' },
];

interface GoalsSectionProps {
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
}

function GoalTypePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (type: string) => void;
}) {
  const c = useThemeColors();
  const pickerStyles = getPickerStyles(c);
  return (
    <View style={pickerStyles.container}>
      <Text style={pickerStyles.label}>Goal Type</Text>
      <View style={pickerStyles.options}>
        {GOAL_TYPES.map((type) => (
          <TouchableOpacity
            key={type.value}
            style={[
              pickerStyles.option,
              value === type.value && pickerStyles.optionActive,
            ]}
            onPress={() => onChange(type.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                pickerStyles.optionText,
                value === type.value && pickerStyles.optionTextActive,
              ]}
            >
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function MacroTargets({
  targets,
}: {
  targets: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
}) {
  const c = useThemeColors();
  const targetStyles = getTargetStyles(c);
  return (
    <View>
      <View style={targetStyles.divider} />
      <Text style={targetStyles.header}>Current Targets</Text>
      <View style={targetStyles.grid}>
        <View style={targetStyles.item}>
          <Text style={[targetStyles.value, { color: c.macro.calories }]}>
            {Math.round(targets.calories)}
          </Text>
          <Text style={targetStyles.label}>kcal</Text>
        </View>
        <View style={targetStyles.item}>
          <Text style={[targetStyles.value, { color: c.macro.protein }]}>
            {Math.round(targets.protein_g)}g
          </Text>
          <Text style={targetStyles.label}>protein</Text>
        </View>
        <View style={targetStyles.item}>
          <Text style={[targetStyles.value, { color: c.macro.carbs }]}>
            {Math.round(targets.carbs_g)}g
          </Text>
          <Text style={targetStyles.label}>carbs</Text>
        </View>
        <View style={targetStyles.item}>
          <Text style={[targetStyles.value, { color: c.macro.fat }]}>
            {Math.round(targets.fat_g)}g
          </Text>
          <Text style={targetStyles.label}>fat</Text>
        </View>
      </View>
    </View>
  );
}

export function GoalsSection({ goals, adaptiveTargets, unitSystem }: GoalsSectionProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const editStyles = getEditStyles(c);
  const { recalculate } = useRecalculate();

  const [editingGoalType, setEditingGoalType] = useState(false);
  const [draftGoalType, setDraftGoalType] = useState<string>('maintaining');
  const [savingGoalType, setSavingGoalType] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weightSuffix = unitSystem === 'metric' ? 'kg' : 'lbs';
  const rateSuffix = unitSystem === 'metric' ? 'kg/week' : 'lbs/week';

  const saveGoals = useCallback(
    async (payload: { goal_type: string; target_weight_kg?: number; goal_rate_per_week?: number }) => {
      setError(null);
      const goalsPayload: Record<string, unknown> = {
        goal_type: payload.goal_type,
      };
      if (payload.target_weight_kg !== undefined) {
        goalsPayload.target_weight_kg = payload.target_weight_kg;
      } else if (goals?.targetWeightKg != null) {
        goalsPayload.target_weight_kg = goals.targetWeightKg;
      }
      if (payload.goal_rate_per_week !== undefined) {
        goalsPayload.goal_rate_per_week = payload.goal_rate_per_week;
      } else if (goals?.goalRatePerWeek != null) {
        goalsPayload.goal_rate_per_week = goals.goalRatePerWeek;
      }

      await recalculate({ goals: goalsPayload });
    },
    [goals, recalculate],
  );

  const handleGoalTypeStart = useCallback(() => {
    setDraftGoalType(goals?.goalType ?? 'maintaining');
    setEditingGoalType(true);
    setError(null);
  }, [goals]);

  const handleGoalTypeCancel = useCallback(() => {
    setEditingGoalType(false);
    setError(null);
  }, []);

  const handleGoalTypeSave = useCallback(async () => {
    setSavingGoalType(true);
    try {
      await saveGoals({ goal_type: draftGoalType });
      setEditingGoalType(false);
    } catch {
      setError("Couldn't save. Check your connection.");
    } finally {
      setSavingGoalType(false);
    }
  }, [draftGoalType, saveGoals]);

  const handleTargetWeightSave = useCallback(
    async (newValue: string) => {
      const num = parseFloat(newValue);
      if (isNaN(num) || num <= 0) throw new Error('Invalid weight');
      const weightKg = parseWeightInput(num, unitSystem);
      await saveGoals({
        goal_type: goals?.goalType ?? 'maintaining',
        target_weight_kg: weightKg,
      });
    },
    [goals, unitSystem, saveGoals],
  );

  const handleGoalRateSave = useCallback(
    async (newValue: string) => {
      const num = parseFloat(newValue);
      if (isNaN(num)) throw new Error('Invalid rate');
      // Rate is stored in kg/week; convert from lbs/week if imperial
      const rateKg = unitSystem === 'imperial' ? num / 2.20462 : num;
      const rounded = Math.round(rateKg * 100) / 100;
      await saveGoals({
        goal_type: goals?.goalType ?? 'maintaining',
        goal_rate_per_week: rounded,
      });
    },
    [goals, unitSystem, saveGoals],
  );

  // ── Empty state ──
  if (!goals) {
    return (
      <Card>
        <EmptyState
          icon={<Icon name="target" size={28} color={c.accent.primary} />}
          title="Goals"
          description="Set your first goal to get personalized calorie and macro targets"
          actionLabel="Set Goal"
          onAction={handleGoalTypeStart}
        />
        {editingGoalType && (
          <View style={editStyles.container}>
            <GoalTypePicker value={draftGoalType} onChange={setDraftGoalType} />
            {error && <Text style={editStyles.error}>{error}</Text>}
            <View style={editStyles.actions}>
              <TouchableOpacity
                style={[editStyles.saveBtn, savingGoalType && editStyles.saveBtnDisabled]}
                onPress={handleGoalTypeSave}
                disabled={savingGoalType}
                activeOpacity={0.7}
              >
                {savingGoalType ? (
                  <ActivityIndicator color={c.text.primary} size="small" />
                ) : (
                  <Text style={editStyles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
              {!savingGoalType && (
                <TouchableOpacity style={editStyles.cancelBtn} onPress={handleGoalTypeCancel} activeOpacity={0.7}>
                  <Text style={editStyles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </Card>
    );
  }

  // ── Normal display mode ──
  const goalTypeLabel = GOAL_TYPES.find((t) => t.value === goals.goalType)?.label ?? goals.goalType ?? '—';
  const targetWeightDisplay =
    goals.targetWeightKg != null ? formatWeight(goals.targetWeightKg, unitSystem) : '—';

  const goalRateDisplay = (() => {
    if (goals.goalRatePerWeek == null) return '—';
    const rate =
      unitSystem === 'imperial'
        ? Math.round(goals.goalRatePerWeek * 2.20462 * 10) / 10
        : Math.round(goals.goalRatePerWeek * 10) / 10;
    const sign = rate > 0 ? '+' : '';
    return `${sign}${rate} ${rateSuffix}`;
  })();

  return (
    <Card>
      <Text style={styles.sectionTitle}>Goals</Text>

      {/* Goal Type — tappable pills */}
      {editingGoalType ? (
        <View style={editStyles.container}>
          <GoalTypePicker value={draftGoalType} onChange={setDraftGoalType} />
          {error && <Text style={editStyles.error}>{error}</Text>}
          <View style={editStyles.actions}>
            <TouchableOpacity
              style={[editStyles.saveBtn, savingGoalType && editStyles.saveBtnDisabled]}
              onPress={handleGoalTypeSave}
              disabled={savingGoalType}
              activeOpacity={0.7}
            >
              {savingGoalType ? (
                <ActivityIndicator color={c.text.primary} size="small" />
              ) : (
                <Text style={editStyles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
            {!savingGoalType && (
              <TouchableOpacity style={editStyles.cancelBtn} onPress={handleGoalTypeCancel} activeOpacity={0.7}>
                <Text style={editStyles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.goalTypeRow} onPress={handleGoalTypeStart} activeOpacity={0.7}>
          <Text style={styles.goalTypeLabel}>Goal Type</Text>
          <View style={styles.goalTypeValueRow}>
            <Text style={styles.goalTypeValue}>{goalTypeLabel}</Text>
            <Icon name="edit" size={14} color={c.text.muted} />
          </View>
        </TouchableOpacity>
      )}

      {/* Target Weight */}
      <EditableField
        label={`Target Weight (${weightSuffix})`}
        value={targetWeightDisplay}
        onSave={handleTargetWeightSave}
      />

      {/* Goal Rate */}
      <EditableField
        label={`Goal Rate (${rateSuffix})`}
        value={goalRateDisplay}
        onSave={handleGoalRateSave}
      />

      {/* Inline error */}
      {error && !editingGoalType && <Text style={editStyles.error}>{error}</Text>}

      {/* Current Targets */}
      {adaptiveTargets && <MacroTargets targets={adaptiveTargets} />}
    </Card>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  sectionTitle: {
    color: c.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.md,
    marginBottom: spacing[2],
  },
  goalTypeRow: {
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: c.border.subtle,
  },
  goalTypeLabel: {
    color: c.text.muted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
    marginBottom: spacing[1],
  },
  goalTypeValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalTypeValue: {
    color: c.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.base,
    flex: 1,
  },
});

const getEditStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    paddingTop: spacing[2],
  },
  error: {
    color: c.semantic.negative,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginTop: spacing[2],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  saveBtn: {
    backgroundColor: c.accent.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: c.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.base,
  },
  cancelBtn: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: c.text.muted,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.base,
  },
});

const getPickerStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    marginBottom: spacing[3],
  },
  label: {
    color: c.text.muted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
    marginBottom: spacing[2],
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  option: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[3],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border.default,
    backgroundColor: c.bg.surface,
    minHeight: 44,
    justifyContent: 'center',
  },
  optionActive: {
    borderColor: c.accent.primary,
    backgroundColor: c.accent.primaryMuted,
  },
  optionText: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  optionTextActive: {
    color: c.accent.primary,
  },
});

const getTargetStyles = (c: ThemeColors) => StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: c.border.subtle,
    marginTop: spacing[4],
    marginBottom: spacing[3],
  },
  header: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.sm,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.wide,
    marginBottom: spacing[3],
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  item: {
    alignItems: 'center',
    flex: 1,
  },
  value: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.md,
    marginBottom: spacing[1],
  },
  label: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.xs,
  },
});
