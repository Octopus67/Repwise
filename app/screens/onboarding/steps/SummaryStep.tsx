import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, typography, radius } from '../../../theme/tokens';
import { Button } from '../../../components/common/Button';
import { useOnboardingStore, computeAge } from '../../../store/onboardingSlice';
import {
  computeTDEEBreakdown,
  computeCalorieBudget,
  computeMacroSplit,
} from '../../../utils/onboardingCalculations';

interface Props { onNext?: () => void; onBack?: () => void; onSkip?: () => void; onComplete?: () => void; onEditStep?: (step: number) => void; }

const GOAL_LABELS: Record<string, string> = {
  lose_fat: 'Lose Fat',
  build_muscle: 'Build Muscle',
  maintain: 'Maintain',
  eat_healthier: 'Eat Healthier',
};

const DIET_LABELS: Record<string, string> = {
  balanced: 'Balanced',
  high_protein: 'High Protein',
  low_carb: 'Low Carb',
  keto: 'Keto',
};

export function SummaryStep({ onComplete, onEditStep }: Props) {
  const store = useOnboardingStore();
  const age = computeAge(store.birthYear, store.birthMonth);
  const goalType = store.goalType ?? 'maintain';

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

  const budget = useMemo(
    () => computeCalorieBudget(tdee, goalType, store.rateKgPerWeek, store.sex),
    [tdee, goalType, store.rateKgPerWeek, store.sex],
  );

  const macros = useMemo(
    () => computeMacroSplit(budget.budget, store.weightKg, store.proteinPerKg, store.dietStyle),
    [budget.budget, store.weightKg, store.proteinPerKg, store.dietStyle],
  );

  const rows: { label: string; value: string; editStep: number }[] = [
    { label: 'Daily Calories', value: `${budget.budget.toLocaleString()} kcal`, editStep: 6 },
    { label: 'Protein', value: `${macros.proteinG}g`, editStep: 7 },
    { label: 'Carbs', value: `${macros.carbsG}g`, editStep: 7 },
    { label: 'Fat', value: `${macros.fatG}g`, editStep: 7 },
    { label: 'Goal', value: GOAL_LABELS[goalType] ?? goalType, editStep: 1 },
    { label: 'Rate', value: goalType === 'maintain' || goalType === 'eat_healthier' ? '—' : `${store.rateKgPerWeek} kg/wk`, editStep: 6 },
    { label: 'TDEE', value: `${tdee.toLocaleString()} kcal`, editStep: 5 },
    { label: 'Diet Style', value: DIET_LABELS[store.dietStyle] ?? store.dietStyle, editStep: 7 },
  ];

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.heading}>Your Plan</Text>
      <Text style={styles.subheading}>Review your personalized numbers — tap any row to edit</Text>

      <View style={styles.card}>
        {rows.map((row, i) => (
          <TouchableOpacity
            key={row.label}
            style={[styles.row, i < rows.length - 1 && styles.rowBorder]}
            onPress={() => onEditStep?.(row.editStep)}
            activeOpacity={0.6}
          >
            <Text style={styles.rowLabel}>{row.label}</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{row.value}</Text>
              <Text style={styles.editIcon}>›</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {onComplete && (
        <Button title="Start Your Journey" onPress={onComplete} style={styles.btn} />
      )}
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing[8] },
  heading: { color: colors.text.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, marginBottom: spacing[2] },
  subheading: { color: colors.text.secondary, fontSize: typography.size.base, marginBottom: spacing[6] },
  card: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
    marginBottom: spacing[6],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  rowLabel: { color: colors.text.secondary, fontSize: typography.size.base },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { color: colors.text.primary, fontSize: typography.size.base, fontWeight: typography.weight.semibold, marginRight: spacing[2] },
  editIcon: { color: colors.text.muted, fontSize: typography.size.lg },
  btn: { marginTop: spacing[2] },
});
