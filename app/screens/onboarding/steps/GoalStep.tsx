import { useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { spacing, typography, radius } from '../../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../../hooks/useThemeColors';
import { Button } from '../../../components/common/Button';
import { Icon } from '../../../components/common/Icon';
import { useOnboardingStore, computeAge } from '../../../store/onboardingSlice';
import { useHaptics } from '../../../hooks/useHaptics';
import {
  computeTDEEBreakdown,
  computeCalorieBudget,
  computeProjectedDate,
} from '../../../utils/onboardingCalculations';
import { formatDateDisplay } from '../../../utils/formatting';

interface Props { onNext?: () => void; onBack?: () => void; onSkip?: () => void; onComplete?: () => void; onEditStep?: (step: number) => void; }

const LOSE_RATES = [0.25, 0.5, 0.75, 1.0];
const BUILD_RATES = [0.1, 0.25, 0.5];

function rateColor(rate: number, isLose: boolean, c: ThemeColors): string {
  if (!isLose) return c.semantic.positive;
  if (rate <= 0.25) return c.semantic.positive;
  if (rate <= 0.5) return c.semantic.warning;
  return c.semantic.negative;
}

export function GoalStep({ onNext }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const store = useOnboardingStore();
  const { impact } = useHaptics();
  const age = computeAge(store.birthYear, store.birthMonth);

  const isImperial = store.unitSystem === 'imperial';
  const KG_TO_LBS = 2.20462;
  const formatRate = (rateKg: number): string => {
    if (isImperial) {
      const lbs = rateKg * KG_TO_LBS;
      return lbs % 1 === 0 ? String(lbs) : lbs.toFixed(1);
    }
    return String(rateKg);
  };
  const rateUnitLabel = isImperial ? 'lbs/wk' : 'kg/wk';

  const tdee = useMemo(() => {
    if (store.tdeeOverride) return store.tdeeOverride;
    if (!store.sex) return 0;
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
  // Recomposition uses calorie cycling (surplus on training days, deficit on rest)
  // so it behaves like maintain for rate selection and projected date — no linear
  // weight trajectory applies.
  const isRecomp = goalType === 'recomposition';
  const isMaintain = goalType === 'maintain' || goalType === 'eat_healthier' || isRecomp;

  const rates = isLose ? LOSE_RATES : isBuild ? BUILD_RATES : [];

  const budget = useMemo(
    () => store.sex ? computeCalorieBudget(tdee, goalType, store.rateKgPerWeek, store.sex) : { budget: tdee, deficit: 0, floorApplied: false },
    [tdee, goalType, store.rateKgPerWeek, store.sex],
  );

  const projectedDate = useMemo(() => {
    if (!store.targetWeightKg || isMaintain) return null;
    return computeProjectedDate(store.weightKg, store.targetWeightKg, store.rateKgPerWeek);
  }, [store.weightKg, store.targetWeightKg, store.rateKgPerWeek, isMaintain]);

  // Target weight validation
  const targetWeightValid = store.targetWeightKg === null || (store.targetWeightKg >= 30 && store.targetWeightKg <= 300);

  // Directional validation: warn if target contradicts goal
  const targetDirectionWarning = useMemo(() => {
    if (!store.targetWeightKg || isMaintain) return null;
    if (isLose && store.targetWeightKg > store.weightKg) {
      return 'Your target weight is higher than your current weight, but your goal is to lose fat.';
    }
    if (isBuild && store.targetWeightKg < store.weightKg) {
      return 'Your target weight is lower than your current weight, but your goal is to build muscle.';
    }
    return null;
  }, [store.targetWeightKg, store.weightKg, isLose, isBuild, isMaintain]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
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
            const color = rateColor(r, isLose, c);
            return (
              <TouchableOpacity
                key={r}
                style={[
                  styles.rateBtn,
                  selected && { borderColor: color, backgroundColor: color + '18' },
                ]}
                onPress={() => { impact('light'); store.updateField('rateKgPerWeek', r); }}
                activeOpacity={0.7}
                accessibilityLabel={`Select rate ${formatRate(r)} ${rateUnitLabel}`}
                accessibilityRole="button"
              >
                <Text style={[styles.rateValue, selected && { color }]}>{formatRate(r)}</Text>
                <Text style={[styles.rateUnit, { color: c.text.muted }]}>{rateUnitLabel}</Text>
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
          You'll reach your goal by {formatDateDisplay(projectedDate)}
        </Text>
      )}

      {/* Target weight input */}
      {!isMaintain && (
        <View style={styles.targetRow}>
          <Text style={[styles.targetLabel, { color: c.text.secondary }]}>Target weight (optional)</Text>
          <TextInput
            style={[styles.targetInput, !targetWeightValid && styles.targetInputError]}
            value={store.targetWeightKg ? String(isImperial ? Math.round(store.targetWeightKg * KG_TO_LBS) : store.targetWeightKg) : ''}
            onChangeText={(t) => {
              const v = parseFloat(t);
              if (isNaN(v)) { store.updateField('targetWeightKg', null); return; }
              store.updateField('targetWeightKg', isImperial ? v / KG_TO_LBS : v);
            }}
            keyboardType="numeric"
            placeholder={isImperial ? 'lbs' : 'kg'}
            placeholderTextColor={c.text.muted}
            accessibilityLabel={`Target weight in ${isImperial ? 'pounds' : 'kilograms'}`}
          />
          {!targetWeightValid && (
            <Text style={[styles.errorText, { color: c.semantic.negative }]}>Target weight must be between {isImperial ? '66-660 lbs' : '30-300 kg'}</Text>
          )}
          {targetDirectionWarning && targetWeightValid && (
            <Text style={[styles.warningHint, { color: c.semantic.warning }]}><Icon name="alert-triangle" size={14} color={c.semantic.warning} /> {targetDirectionWarning}</Text>
          )}
        </View>
      )}

      {onNext && <Button title="Next" onPress={onNext} disabled={!targetWeightValid} style={styles.btn} />}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}


const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  scroll: { paddingBottom: spacing[8] },
  heading: { color: c.text.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, marginBottom: spacing[2] },
  subheading: { color: c.text.secondary, fontSize: typography.size.base, marginBottom: spacing[6] },
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
    borderColor: c.border.default,
    backgroundColor: c.bg.surfaceRaised,
  },
  rateValue: { color: c.text.primary, fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  rateUnit: { color: c.text.muted, fontSize: typography.size.xs, marginTop: 2 },
  budgetCard: {
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing[5],
    alignItems: 'center',
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: c.border.default,
  },
  budgetLabel: { color: c.text.secondary, fontSize: typography.size.sm, marginBottom: spacing[1] },
  budgetValue: { color: c.text.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold },
  warningBanner: {
    backgroundColor: c.semantic.warningSubtle,
    borderRadius: radius.sm,
    padding: spacing[3],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: c.semantic.warning,
  },
  warningText: { color: c.semantic.warning, fontSize: typography.size.sm },
  projected: { color: c.text.secondary, fontSize: typography.size.sm, textAlign: 'center', marginBottom: spacing[5] },
  targetRow: { marginBottom: spacing[5] },
  targetLabel: { color: c.text.secondary, fontSize: typography.size.sm, marginBottom: spacing[2] },
  targetInput: {
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border.default,
    color: c.text.primary,
    fontSize: typography.size.md,
    padding: spacing[3],
  },
  targetInputError: {
    borderColor: c.semantic.negative,
  },
  errorText: {
    color: c.semantic.negative,
    fontSize: typography.size.sm,
    marginTop: spacing[1],
    lineHeight: typography.lineHeight.sm,
  },
  warningHint: {
    color: c.semantic.warning,
    fontSize: typography.size.sm,
    marginTop: spacing[1],
    lineHeight: typography.lineHeight.sm,
  },
  btn: { marginTop: spacing[2] },
});
