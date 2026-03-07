import { useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, typography, radius } from '../../../theme/tokens';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { Button } from '../../../components/common/Button';
import { Icon } from '../../../components/common/Icon';
import { useOnboardingStore, computeAge } from '../../../store/onboardingSlice';
import { useHaptics } from '../../../hooks/useHaptics';
import {
  computeTDEEBreakdown,
  computeCalorieBudget,
  computeProjectedDate,
} from '../../../utils/onboardingCalculations';

interface Props { onNext?: () => void; onBack?: () => void; onSkip?: () => void; onComplete?: () => void; onEditStep?: (step: number) => void; }

const LOSE_RATES = [0.25, 0.5, 0.75, 1.0];
const BUILD_RATES = [0.1, 0.25, 0.5];

function rateColor(rate: number, isLose: boolean): string {
  if (!isLose) return colors.semantic.positive;
  if (rate <= 0.25) return colors.semantic.positive;
  if (rate <= 0.5) return colors.semantic.warning;
  return colors.semantic.negative;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function GoalStep({ onNext }: Props) {
  const c = useThemeColors();
  const store = useOnboardingStore();
  const { impact } = useHaptics();
  const age = computeAge(store.birthYear, store.birthMonth);

  const tdee = useMemo(() => {
    if (store.tdeeOverride) return store.tdeeOverride;
    const bd = computeTDEEBreakdown(
      store.weightKg, store.heightCm, age, store.sex,
      store.activityLevel, store.exerciseSessionsPerWeek,
      store.exerciseTypes.length > 0 ? store.exerciseTypes : ['strength'],
      store.bodyFatPct ?? undefined,
    );
    return bd.total;
  }, [store.tdeeOverride, store.weightKg, store.heightCm, age, store.sex, store.activityLevel, store.exerciseSessionsPerWeek, store.exerciseTypes, store.bodyFatPct]);

  const goalType = store.goalType ?? 'maintain';
  const isLose = goalType === 'lose_fat';
  const isBuild = goalType === 'build_muscle';
  const isMaintain = goalType === 'maintain' || goalType === 'eat_healthier';

  const rates = isLose ? LOSE_RATES : isBuild ? BUILD_RATES : [];

  const budget = useMemo(
    () => computeCalorieBudget(tdee, goalType, store.rateKgPerWeek, store.sex),
    [tdee, goalType, store.rateKgPerWeek, store.sex],
  );

  const projectedDate = useMemo(() => {
    if (!store.targetWeightKg || isMaintain) return null;
    return computeProjectedDate(store.weightKg, store.targetWeightKg, store.rateKgPerWeek);
  }, [store.weightKg, store.targetWeightKg, store.rateKgPerWeek, isMaintain]);

  // Target weight validation
  const targetWeightValid = store.targetWeightKg === null || (store.targetWeightKg >= 30 && store.targetWeightKg <= 300);

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={[styles.heading, { color: c.text.primary }]}>Set Your Pace</Text>
      <Text style={[styles.subheading, { color: c.text.secondary }]}>
        {isMaintain ? 'Maintain your current weight' : `How fast do you want to ${isLose ? 'lose' : 'gain'}?`}
      </Text>

      {/* Rate selector */}
      {!isMaintain && (
        <View style={styles.rateRow}>
          {rates.map((r) => {
            const selected = store.rateKgPerWeek === r;
            const color = rateColor(r, isLose);
            return (
              <TouchableOpacity
                key={r}
                style={[
                  styles.rateBtn,
                  selected && { borderColor: color, backgroundColor: color + '18' },
                ]}
                onPress={() => { impact('light'); store.updateField('rateKgPerWeek', r); }}
                activeOpacity={0.7}
                accessibilityLabel={`Select rate ${r} kg per week`}
                accessibilityRole="button"
              >
                <Text style={[styles.rateValue, selected && { color }]}>{r}</Text>
                <Text style={[styles.rateUnit, { color: c.text.muted }]}>kg/wk</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Live calorie budget */}
      <View style={[styles.budgetCard, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}>
        <Text style={[styles.budgetLabel, { color: c.text.secondary }]}>Your daily budget</Text>
        <Text style={[styles.budgetValue, { color: c.text.primary }]}>{budget.budget.toLocaleString()} kcal</Text>
      </View>

      {/* Calorie floor warning */}
      {budget.floorApplied && (
        <View style={[styles.warningBanner, { backgroundColor: c.semantic.warningSubtle, borderColor: c.semantic.warning }]}>
          <Text style={[styles.warningText, { color: c.semantic.warning }]}>
            <Icon name="warning" size={16} color={c.semantic.warning} />{' '}Calorie floor applied — we won't go below a safe minimum for your profile
          </Text>
        </View>
      )}

      {/* Projected date */}
      {projectedDate && (
        <Text style={[styles.projected, { color: c.text.secondary }]}>
          You'll reach your goal by {formatDate(projectedDate)}
        </Text>
      )}

      {/* Target weight input */}
      {!isMaintain && (
        <View style={styles.targetRow}>
          <Text style={[styles.targetLabel, { color: c.text.secondary }]}>Target weight (optional)</Text>
          <TextInput
            style={[styles.targetInput, !targetWeightValid && styles.targetInputError]}
            value={store.targetWeightKg ? String(store.targetWeightKg) : ''}
            onChangeText={(t) => {
              const v = parseFloat(t);
              store.updateField('targetWeightKg', isNaN(v) ? null : v);
            }}
            keyboardType="numeric"
            placeholder="kg"
            placeholderTextColor={c.text.muted}
            accessibilityLabel="Target weight in kilograms"
          />
          {!targetWeightValid && (
            <Text style={[styles.errorText, { color: c.semantic.negative }]}>Target weight must be between 30-300 kg</Text>
          )}
        </View>
      )}

      {onNext && <Button title="Next" onPress={onNext} style={styles.btn} />}
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing[8] },
  heading: { color: colors.text.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, marginBottom: spacing[2] },
  subheading: { color: colors.text.secondary, fontSize: typography.size.base, marginBottom: spacing[6] },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[5],
  },
  rateBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[3],
    marginHorizontal: spacing[1],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.surfaceRaised,
  },
  rateValue: { color: colors.text.primary, fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  rateUnit: { color: colors.text.muted, fontSize: typography.size.xs, marginTop: 2 },
  budgetCard: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing[5],
    alignItems: 'center',
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  budgetLabel: { color: colors.text.secondary, fontSize: typography.size.sm, marginBottom: spacing[1] },
  budgetValue: { color: colors.text.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold },
  warningBanner: {
    backgroundColor: colors.semantic.warningSubtle,
    borderRadius: radius.sm,
    padding: spacing[3],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.semantic.warning,
  },
  warningText: { color: colors.semantic.warning, fontSize: typography.size.sm },
  projected: { color: colors.text.secondary, fontSize: typography.size.sm, textAlign: 'center', marginBottom: spacing[5] },
  targetRow: { marginBottom: spacing[5] },
  targetLabel: { color: colors.text.secondary, fontSize: typography.size.sm, marginBottom: spacing[2] },
  targetInput: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    color: colors.text.primary,
    fontSize: typography.size.md,
    padding: spacing[3],
  },
  targetInputError: {
    borderColor: colors.semantic.negative,
  },
  errorText: {
    color: colors.semantic.negative,
    fontSize: typography.size.sm,
    marginTop: spacing[1],
    lineHeight: typography.lineHeight.sm,
  },
  btn: { marginTop: spacing[2] },
});
