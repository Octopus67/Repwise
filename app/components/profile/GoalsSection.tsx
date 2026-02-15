import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Card } from '../common/Card';
import { EditableField } from '../common/EditableField';
import { EmptyState } from '../common/EmptyState';
import { Icon } from '../common/Icon';
import { formatWeight, parseWeightInput } from '../../utils/unitConversion';
import { useStore } from '../../store';
import api from '../../services/api';

const GOAL_TYPES = [
  { value: 'cutting', label: 'Cutting' },
  { value: 'maintaining', label: 'Maintaining' },
  { value: 'bulking', label: 'Bulking' },
  { value: 'recomposition', label: 'Body Recomposition' },
] as const;

type GoalType = (typeof GOAL_TYPES)[number]['value'];

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
  return (
    <View>
      <View style={targetStyles.divider} />
      <Text style={targetStyles.header}>Current Targets</Text>
      <View style={targetStyles.grid}>
        <View style={targetStyles.item}>
          <Text style={[targetStyles.value, { color: colors.macro.calories }]}>
            {Math.round(targets.calories)}
          </Text>
          <Text style={targetStyles.label}>kcal</Text>
        </View>
        <View style={targetStyles.item}>
          <Text style={[targetStyles.value, { color: colors.macro.protein }]}>
            {Math.round(targets.protein_g)}g
          </Text>
          <Text style={targetStyles.label}>protein</Text>
        </View>
        <View style={targetStyles.item}>
          <Text style={[targetStyles.value, { color: colors.macro.carbs }]}>
            {Math.round(targets.carbs_g)}g
          </Text>
          <Text style={targetStyles.label}>carbs</Text>
        </View>
        <View style={targetStyles.item}>
          <Text style={[targetStyles.value, { color: colors.macro.fat }]}>
            {Math.round(targets.fat_g)}g
          </Text>
          <Text style={targetStyles.label}>fat</Text>
        </View>
      </View>
    </View>
  );
}

export function GoalsSection({ goals, adaptiveTargets, unitSystem }: GoalsSectionProps) {
  const store = useStore();

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

      const { data } = await api.post('users/recalculate', { goals: goalsPayload });

      if (data.goals) {
        store.setGoals({
          id: data.goals.id,
          userId: data.goals.user_id,
          goalType: data.goals.goal_type,
          targetWeightKg: data.goals.target_weight_kg,
          goalRatePerWeek: data.goals.goal_rate_per_week,
        });
      }
      if (data.targets) {
        store.setAdaptiveTargets({
          calories: data.targets.calories,
          protein_g: data.targets.protein_g,
          carbs_g: data.targets.carbs_g,
          fat_g: data.targets.fat_g,
        });
      }
    },
    [goals, store],
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
          icon={<Icon name="target" size={28} color={colors.accent.primary} />}
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
                  <ActivityIndicator color={colors.text.primary} size="small" />
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
                <ActivityIndicator color={colors.text.primary} size="small" />
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
            <Icon name="edit" size={14} color={colors.text.muted} />
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

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[2],
  },
  goalTypeRow: {
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  goalTypeLabel: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[1],
  },
  goalTypeValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalTypeValue: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    flex: 1,
  },
});

const editStyles = StyleSheet.create({
  container: {
    paddingTop: spacing[2],
  },
  error: {
    color: colors.semantic.negative,
    fontSize: typography.size.sm,
    marginTop: spacing[2],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  saveBtn: {
    backgroundColor: colors.accent.primary,
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
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  cancelBtn: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: colors.text.muted,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
});

const pickerStyles = StyleSheet.create({
  container: {
    marginBottom: spacing[3],
  },
  label: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
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
    borderColor: colors.border.default,
    backgroundColor: colors.bg.surface,
  },
  optionActive: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.primaryMuted,
  },
  optionText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  optionTextActive: {
    color: colors.accent.primary,
  },
});

const targetStyles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginTop: spacing[4],
    marginBottom: spacing[3],
  },
  header: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    marginBottom: spacing[1],
  },
  label: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
});
