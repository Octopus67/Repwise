import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import Animated from 'react-native-reanimated';
import { colors, spacing, typography, radius } from '../../../theme/tokens';
import { Button } from '../../../components/common/Button';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { useOnboardingStore, computeAge } from '../../../store/onboardingSlice';
import { useStore as useMainStore } from '../../../store';
import { buildOnboardingPayload } from '../../../utils/onboardingPayloadBuilder';
import api from '../../../services/api';
import {
  computeTDEEBreakdown,
  computeCalorieBudget,
  computeMacroSplit,
} from '../../../utils/onboardingCalculations';
import { useStaggeredEntrance } from '../../../hooks/useStaggeredEntrance';

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

function SummaryRow({ index, children }: { index: number; children: React.ReactNode }) {
  const style = useStaggeredEntrance(index);
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function SummaryStep({ onComplete, onEditStep }: Props) {
  const store = useOnboardingStore();
  const mainStore = useMainStore();
  const age = computeAge(store.birthYear, store.birthMonth);
  const goalType = store.goalType ?? 'maintain';
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleComplete = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const payload = buildOnboardingPayload(store);
      const { data } = await api.post('onboarding/complete', payload);

      if (data.snapshot) {
        mainStore.setAdaptiveTargets({
          calories: data.snapshot.target_calories,
          protein_g: data.snapshot.target_protein_g,
          carbs_g: data.snapshot.target_carbs_g,
          fat_g: data.snapshot.target_fat_g,
        });
      }
      if (data.goals) {
        mainStore.setGoals(data.goals);
      }

      store.reset();
      await onComplete?.();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        try {
          const [goalsRes, snapshotRes] = await Promise.all([
            api.get('users/goals'),
            api.get('adaptive/snapshots', { params: { limit: 1 } }),
          ]);

          if (snapshotRes.data.items?.[0]) {
            const snap = snapshotRes.data.items[0];
            mainStore.setAdaptiveTargets({
              calories: snap.target_calories,
              protein_g: snap.target_protein_g,
              carbs_g: snap.target_carbs_g,
              fat_g: snap.target_fat_g,
            });
          }
          if (goalsRes.data) {
            mainStore.setGoals(goalsRes.data);
          }
        } catch {
          // Ignore fetch errors on 409 — dashboard will load data anyway
        }

        store.reset();
        await onComplete?.();
        return;
      }

      const message = err?.response?.data?.message || 'Failed to save your plan. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

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

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <View style={styles.card}>
        {rows.map((row, i) => (
          <SummaryRow key={row.label} index={i}>
            <TouchableOpacity
              style={[styles.row, i < rows.length - 1 && styles.rowBorder]}
              onPress={() => onEditStep?.(row.editStep)}
              activeOpacity={0.6}
              disabled={submitting}
              accessibilityLabel={`Edit ${row.label}: ${row.value}`}
              accessibilityRole="button"
            >
              <Text style={styles.rowLabel}>{row.label}</Text>
              <View style={styles.rowRight}>
                <Text style={styles.rowValue}>{row.value}</Text>
                <Text style={styles.editIcon}>›</Text>
              </View>
            </TouchableOpacity>
          </SummaryRow>
        ))}
      </View>

      {onComplete && (
        <View style={styles.btn}>
          <Button 
            title={submitting ? "Submitting..." : "Start Your Journey"} 
            onPress={handleComplete} 
            disabled={submitting}
            loading={submitting}
          />
        </View>
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
