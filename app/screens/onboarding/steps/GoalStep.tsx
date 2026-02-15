import { useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, typography, radius } from '../../../theme/tokens';
import { Button } from '../../../components/common/Button';
import { Icon } from '../../../components/common/Icon';
import { useOnboardingStore, computeAge } from '../../../store/onboardingSlice';
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
  const store = useOnboardingStore();
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

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.heading}>Set Your Pace</Text>
      <Text style={styles.subheading}>
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
                onPress={() => store.updateField('rateKgPerWeek', r)}
                activeOpacity={0.7}
              >
                <Text style={[styles.rateValue, selected && { color }]}>{r}</Text>
                <Text style={styles.rateUnit}>kg/wk</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Live calorie budget */}
      <View style={styles.budgetCard}>
        <Text style={styles.budgetLabel}>Your daily budget</Text>
        <Text style={styles.budgetValue}>{budget.budget.toLocaleString()} kcal</Text>
      </View>

      {/* Calorie floor warning */}
      {budget.floorApplied && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            <Icon name="warning" size={16} color={colors.semantic.warning} />{' '}Calorie floor applied — we won't go below a safe minimum for your profile
          </Text>
        </View>
      )}

      {/* Projected date */}
      {projectedDate && (
        <Text style={styles.projected}>
          You'll reach your goal by {formatDate(projectedDate)}
        </Text>
      )}

      {/* Target weight input */}
      {!isMaintain && (
        <View style={styles.targetRow}>
          <Text style={styles.targetLabel}>Target weight (optional)</Text>
          <TextInput
            style={styles.targetInput}
            value={store.targetWeightKg ? String(store.targetWeightKg) : ''}
            onChangeText={(t) => {
              const v = parseFloat(t);
              store.updateField('targetWeightKg', isNaN(v) ? null : v);
            }}
            keyboardType="numeric"
            placeholder="kg"
            placeholderTextColor={colors.text.muted}
          />
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
  btn: { marginTop: spacing[2] },
});
