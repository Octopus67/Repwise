import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import Animated from 'react-native-reanimated';
import { spacing, typography, radius } from '../../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../../hooks/useThemeColors';
import { Button } from '../../../components/common/Button';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { useOnboardingStore, computeAge } from '../../../store/onboardingSlice';
import { useStore as useMainStore } from '../../../store';
import { buildOnboardingPayload } from '../../../utils/onboardingPayloadBuilder';
import { showAlert } from '../../../utils/crossPlatformAlert';
import api from '../../../services/api';
import type { AxiosError } from 'axios';
import { getApiErrorMessage } from '../../../utils/errors';
import {
  computeTDEEBreakdown,
  computeCalorieBudget,
  computeMacroSplit,
} from '../../../utils/onboardingCalculations';
import { useStaggeredEntrance } from '../../../hooks/useStaggeredEntrance';
import { ONBOARDING_STEPS } from '../stepConstants';

interface Props { onNext?: () => void; onBack?: () => void; onSkip?: () => void; onComplete?: () => void; onEditStep?: (step: number) => void; }

const GOAL_LABELS: Record<string, string> = {
  lose_fat: 'Lose Fat',
  build_muscle: 'Build Muscle',
  maintain: 'Maintain',
  eat_healthier: 'Eat Healthier',
  recomposition: 'Body Recomposition',
};

const DIET_LABELS: Record<string, string> = {
  balanced: 'Balanced',
  high_protein: 'Performance',
  low_carb: 'Low Carb',
  keto: 'Keto',
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary',
  lightly_active: 'Lightly Active',
  moderately_active: 'Moderately Active',
  highly_active: 'Highly Active',
  very_highly_active: 'Very Highly Active',
};

function SummaryRow({ index, children }: { index: number; children: React.ReactNode }) {
  const style = useStaggeredEntrance(index);
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function SummaryStep({ onComplete, onEditStep }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const store = useOnboardingStore();
  const mainStore = useMainStore();
  const age = computeAge(store.birthYear, store.birthMonth);
  const goalType = store.goalType ?? 'maintain';
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const budget = useMemo(
    () => store.sex ? computeCalorieBudget(tdee, goalType, store.rateKgPerWeek, store.sex) : { budget: tdee, deficit: 0, floorApplied: false },
    [tdee, goalType, store.rateKgPerWeek, store.sex],
  );

  const macros = useMemo(
    () => computeMacroSplit(budget.budget, store.weightKg, store.proteinPerKg, store.dietStyle),
    [budget.budget, store.weightKg, store.proteinPerKg, store.dietStyle],
  );

  const handleComplete = async () => {
    showAlert(
      'Start Your Journey?',
      'This will finalize your onboarding and create your personalized plan.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Let\'s Go', onPress: doSubmit },
      ],
    );
  };

  const doSubmit = async () => {
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
    } catch (err: unknown) {
      if ((err as AxiosError)?.response?.status === 409) {
        try {
          const [goalsRes, snapshotRes] = await Promise.all([
            api.get('users/goals'),
            api.get('adaptive/snapshots', { params: { limit: 1 } }),
          ]);

          if (snapshotRes.data?.items?.[0]) {
            const snap = snapshotRes.data?.items?.[0];
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
        } catch (err) {
          console.warn('[SummaryStep] post-409 data fetch failed:', String(err));
        }

        store.reset();
        await onComplete?.();
        return;
      }

      const message = getApiErrorMessage(err, 'Failed to save your plan. Please try again.');
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Macro percentages for stacked bar
  const totalMacroKcal = macros.proteinG * 4 + macros.carbsG * 4 + macros.fatG * 9;
  const proteinPct = totalMacroKcal > 0 ? Math.round((macros.proteinG * 4 / totalMacroKcal) * 100) : 0;
  const carbsPct = totalMacroKcal > 0 ? Math.round((macros.carbsG * 4 / totalMacroKcal) * 100) : 0;
  const fatPct = 100 - proteinPct - carbsPct;

  // Format height for display
  const heightDisplay = store.unitSystem === 'imperial'
    ? `${Math.floor(store.heightCm / 2.54 / 12)}'${Math.round((store.heightCm / 2.54) % 12)}"`
    : `${Math.round(store.heightCm)} cm`;

  // Format weight for display
  const weightDisplay = store.unitSystem === 'imperial'
    ? `${Math.round(store.weightKg * 2.20462)} lbs`
    : `${store.weightKg.toFixed(1)} kg`;

  // Food DNA summary
  const foodDnaSummary = store.foodDnaSkipped
    ? 'Skipped'
    : [
        ...store.dietaryRestrictions.map((r) => r.replace(/_/g, ' ')),
        ...store.allergies.filter((a) => a !== 'none'),
      ].join(', ') || 'None set';

  type SummarySection = { title: string; rows: { label: string; value: string; editStep: number }[] };

  const sections: SummarySection[] = [
    {
      title: 'Body',
      rows: [
        { label: 'Height', value: heightDisplay, editStep: ONBOARDING_STEPS.BODY_MEASUREMENTS },
        { label: 'Weight', value: weightDisplay, editStep: ONBOARDING_STEPS.BODY_MEASUREMENTS },
        { label: 'Age', value: `${age} years`, editStep: ONBOARDING_STEPS.BODY_BASICS },
        ...(store.bodyFatPct ? [{ label: 'Body Fat', value: `${store.bodyFatPct}%`, editStep: ONBOARDING_STEPS.BODY_COMPOSITION }] : []),
      ],
    },
    {
      title: 'Activity',
      rows: [
        { label: 'Activity Level', value: ACTIVITY_LABELS[store.activityLevel] ?? store.activityLevel, editStep: ONBOARDING_STEPS.LIFESTYLE },
        { label: 'Exercise', value: `${store.exerciseSessionsPerWeek}x/week`, editStep: ONBOARDING_STEPS.LIFESTYLE },
      ],
    },
    {
      title: 'Goal & Nutrition',
      rows: [
        { label: 'Goal', value: GOAL_LABELS[goalType] ?? goalType, editStep: ONBOARDING_STEPS.INTENT },
        { label: 'Rate', value: goalType === 'maintain' || goalType === 'eat_healthier' ? '—' : `${store.rateKgPerWeek} kg/wk`, editStep: ONBOARDING_STEPS.GOAL },
        { label: 'TDEE', value: `${tdee.toLocaleString()} kcal`, editStep: ONBOARDING_STEPS.TDEE_REVEAL },
        { label: 'Daily Calories', value: `${budget.budget.toLocaleString()} kcal`, editStep: ONBOARDING_STEPS.GOAL },
        { label: 'Diet Style', value: DIET_LABELS[store.dietStyle] ?? store.dietStyle, editStep: ONBOARDING_STEPS.DIET_STYLE },
      ],
    },
    {
      title: 'Food DNA',
      rows: [
        { label: 'Preferences', value: foodDnaSummary, editStep: ONBOARDING_STEPS.FOOD_DNA },
        { label: 'Meals/Day', value: String(store.mealFrequency), editStep: ONBOARDING_STEPS.FOOD_DNA },
      ],
    },
  ];

  // Pre-compute row indices to avoid mutable counter during render
  const sectionRowIndices = useMemo(() => {
    let idx = 0;
    return sections.map((section) =>
      section.rows.map(() => idx++),
    );
  }, [sections]);

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={[styles.heading, { color: c.text.primary }]}>Your Plan</Text>
      <Text style={[styles.subheading, { color: c.text.secondary }]}>Review your personalized numbers — tap any row to edit</Text>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Macro breakdown stacked bar */}
      <View style={[styles.macroBarCard, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}>
        <View style={styles.macroBarRow}>
          <View style={[styles.macroBarSegment, { flex: proteinPct, backgroundColor: c.macro.protein }]} />
          <View style={[styles.macroBarSegment, { flex: carbsPct, backgroundColor: c.macro.carbs }]} />
          <View style={[styles.macroBarSegment, { flex: fatPct, backgroundColor: c.macro.fat }]} />
        </View>
        <View style={styles.macroLegendRow}>
          <View style={styles.macroLegendItem}>
            <View style={[styles.macroLegendDot, { backgroundColor: c.macro.protein }]} />
            <Text style={[styles.macroLegendText, { color: c.text.secondary }]}>Protein {macros.proteinG}g ({proteinPct}%)</Text>
          </View>
          <View style={styles.macroLegendItem}>
            <View style={[styles.macroLegendDot, { backgroundColor: c.macro.carbs }]} />
            <Text style={[styles.macroLegendText, { color: c.text.secondary }]}>Carbs {macros.carbsG}g ({carbsPct}%)</Text>
          </View>
          <View style={styles.macroLegendItem}>
            <View style={[styles.macroLegendDot, { backgroundColor: c.macro.fat }]} />
            <Text style={[styles.macroLegendText, { color: c.text.secondary }]}>Fat {macros.fatG}g ({fatPct}%)</Text>
          </View>
        </View>
      </View>

      {/* Sections */}
      {sections.map((section, sectionIdx) => (
        <View key={section.title}>
          <Text style={[styles.sectionTitle, { color: c.text.muted }]}>{section.title}</Text>
          <View style={[styles.card, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}>
            {section.rows.map((row, i) => (
                <SummaryRow key={row.label} index={sectionRowIndices[sectionIdx][i]}>
                  <TouchableOpacity
                    style={[styles.row, i < section.rows.length - 1 && styles.rowBorder]}
                    onPress={() => onEditStep?.(row.editStep)}
                    activeOpacity={0.6}
                    disabled={submitting}
                    accessibilityLabel={`Edit ${row.label}: ${row.value}`}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.rowLabel, { color: c.text.secondary }]}>{row.label}</Text>
                    <View style={styles.rowRight}>
                      <Text style={[styles.rowValue, { color: c.text.primary }]}>{row.value}</Text>
                      <Text style={[styles.editIcon, { color: c.text.muted }]}>›</Text>
                    </View>
                  </TouchableOpacity>
                </SummaryRow>
            ))}
          </View>
        </View>
      ))}

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


const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  scroll: { paddingBottom: spacing[8] },
  heading: { color: c.text.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, marginBottom: spacing[2] },
  subheading: { color: c.text.secondary, fontSize: typography.size.base, marginBottom: spacing[6] },
  sectionTitle: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
    marginTop: spacing[4],
  },
  macroBarCard: {
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.default,
    padding: spacing[4],
    marginBottom: spacing[2],
  },
  macroBarRow: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: spacing[3],
  },
  macroBarSegment: {
    height: '100%',
  },
  macroLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  macroLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  macroLegendText: {
    fontSize: typography.size.xs,
    color: c.text.secondary,
  },
  card: {
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.default,
    overflow: 'hidden',
    marginBottom: spacing[2],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.border.subtle },
  rowLabel: { color: c.text.secondary, fontSize: typography.size.base },
  rowRight: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  rowValue: { color: c.text.primary, fontSize: typography.size.base, fontWeight: typography.weight.semibold, marginRight: spacing[2] },
  editIcon: { color: c.text.muted, fontSize: typography.size.lg },
  btn: { marginTop: spacing[4] },
});
