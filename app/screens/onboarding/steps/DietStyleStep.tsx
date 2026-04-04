import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { spacing, typography, radius } from '../../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../../hooks/useThemeColors';
import { Button } from '../../../components/common/Button';
import { useOnboardingStore, DietStyle, computeAge } from '../../../store/onboardingSlice';
import {
  computeTDEEBreakdown,
  computeCalorieBudget,
  computeMacroSplit,
} from '../../../utils/onboardingCalculations';

interface Props {
  onNext?: () => void;
  onBack?: () => void;
}

const DIET_STYLES: { type: DietStyle; title: string; desc: string }[] = [
  { type: 'balanced', title: 'Balanced', desc: 'Moderate carbs and fats for general health' },
  { type: 'high_protein', title: 'Performance', desc: 'Higher carbs for training energy and recovery' },
  { type: 'low_carb', title: 'Low Carb', desc: 'Lower carbs, higher fats for steady energy' },
  { type: 'keto', title: 'Keto', desc: 'Very low carb (<50g) for ketosis' },
];

export function DietStyleStep({ onNext }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const store = useOnboardingStore();
  const age = computeAge(store.birthYear, store.birthMonth);
  const goalType = store.goalType ?? 'maintain';

  // Get protein recommendation based on goal
  const proteinRec = useMemo(() => {
    if (goalType === 'lose_fat') return { min: 1.6, max: 2.2, default: 1.8, label: 'Cutting' };
    if (goalType === 'build_muscle') return { min: 1.6, max: 2.0, default: 1.7, label: 'Bulking' };
    if (goalType === 'recomposition') return { min: 1.6, max: 2.2, default: 1.8, label: 'Recomp' };
    return { min: 1.4, max: 1.8, default: 1.6, label: 'Maintenance' };
  }, [goalType]);

  // Initialize protein if not set
  const [proteinPerKg, setProteinPerKg] = useState(store.proteinPerKg || proteinRec.default);

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
    () => store.sex ? computeCalorieBudget(tdee, goalType, store.rateKgPerWeek, store.sex).budget : 0,
    [tdee, goalType, store.rateKgPerWeek, store.sex],
  );

  // Compute macros for each diet style with current protein
  const styleMacros = useMemo(
    () => DIET_STYLES.map((d) => ({
      style: d.type,
      macros: computeMacroSplit(budget, store.weightKg, proteinPerKg, d.type),
    })),
    [budget, store.weightKg, proteinPerKg],
  );

  const handleStyleSelect = (style: DietStyle) => {
    store.updateField('dietStyle', style);
  };

  const handleProteinChange = (value: number) => {
    const rounded = Math.round(value * 10) / 10; // Round to 0.1
    setProteinPerKg(rounded);
    store.updateField('proteinPerKg', rounded);
    store.updateField('proteinUserModified', true);
  };

  const handleNext = () => {
    // Ensure protein is saved
    store.updateField('proteinPerKg', proteinPerKg);
    onNext?.();
  };

  const dailyProtein = Math.round(proteinPerKg * store.weightKg);

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <Text style={[styles.heading, { color: c.text.primary }]}>Nutrition Style</Text>
      <Text style={[styles.subheading, { color: c.text.secondary }]}>
        Choose how you prefer to eat
      </Text>

      {/* Daily Calorie Budget */}
      <View style={[styles.calorieCard, { backgroundColor: c.bg.surfaceRaised, borderColor: c.accent.primary }]}>
        <Text style={[styles.calorieLabel, { color: c.text.secondary }]}>Your Daily Calorie Target</Text>
        <Text style={[styles.calorieValue, { color: c.accent.primary }]}>{budget.toLocaleString()} kcal</Text>
        <Text style={[styles.calorieNote, { color: c.text.muted }]}>
          Based on your TDEE and {goalType === 'lose_fat' ? 'deficit' : goalType === 'build_muscle' ? 'surplus' : 'maintenance'} goal
        </Text>
      </View>

      {/* Protein Target */}
      <View style={[styles.section, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}>
        <Text style={[styles.sectionTitle, { color: c.text.primary }]}>PROTEIN TARGET</Text>
        
        <View style={styles.proteinStepper}>
          <TouchableOpacity
            style={[styles.stepperBtn, { borderColor: c.border.default }]}
            onPress={() => handleProteinChange(Math.max(1.2, proteinPerKg - 0.1))}
            disabled={proteinPerKg <= 1.2}
          >
            <Text style={[styles.stepperText, { color: proteinPerKg <= 1.2 ? c.text.muted : c.text.primary }]}>−</Text>
          </TouchableOpacity>
          
          <View style={styles.proteinDisplay}>
            <Text style={[styles.proteinValue, { color: c.accent.primary }]}>
              {proteinPerKg.toFixed(1)} g/kg
            </Text>
            <Text style={[styles.proteinDaily, { color: c.text.muted }]}>
              {dailyProtein}g per day
            </Text>
          </View>
          
          <TouchableOpacity
            style={[styles.stepperBtn, { borderColor: c.border.default }]}
            onPress={() => handleProteinChange(Math.min(2.4, proteinPerKg + 0.1))}
            disabled={proteinPerKg >= 2.4}
          >
            <Text style={[styles.stepperText, { color: proteinPerKg >= 2.4 ? c.text.muted : c.text.primary }]}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.recBadge, { backgroundColor: c.accent.primaryMuted }]}>
          <Text style={[styles.recBadgeText, { color: c.accent.primary }]}>
            Recommended: {proteinRec.min}-{proteinRec.max} g/kg for {proteinRec.label.toLowerCase()}
          </Text>
        </View>

        <Text style={[styles.proteinNote, { color: c.text.muted }]}>
          {proteinPerKg < proteinRec.min && 'Below recommended range for muscle preservation'}
          {proteinPerKg >= proteinRec.min && proteinPerKg <= proteinRec.max && 'Optimal for your goal'}
          {proteinPerKg > proteinRec.max && 'Above recommended range (not harmful, just expensive)'}
        </Text>
      </View>

      {/* Diet Style Cards */}
      <View style={styles.stylesContainer}>
        <Text style={[styles.sectionTitle, { color: c.text.primary }]}>DIET STYLE</Text>
        
        {DIET_STYLES.map((dietStyle, idx) => {
          const isSelected = store.dietStyle === dietStyle.type;
          const macros = styleMacros[idx]?.macros;
          
          return (
            <TouchableOpacity
              key={dietStyle.type}
              style={[
                styles.styleCard,
                { backgroundColor: c.bg.surfaceRaised, borderColor: isSelected ? c.accent.primary : c.border.default },
                isSelected && styles.styleCardSelected,
              ]}
              onPress={() => handleStyleSelect(dietStyle.type)}
              activeOpacity={0.7}
            >
              <View style={styles.styleHeader}>
                <Text style={[styles.styleTitle, { color: isSelected ? c.accent.primary : c.text.primary }]}>
                  {dietStyle.title}
                </Text>
                {isSelected && (
                  <View style={[styles.checkmark, { backgroundColor: c.accent.primary }]}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.styleDesc, { color: c.text.muted }]}>{dietStyle.desc}</Text>
              
              {macros && (
                <View style={styles.macroRow}>
                  <View style={styles.macroItem}>
                    <Text style={[styles.macroValue, { color: c.macro.protein }]}>{macros.proteinG}g</Text>
                    <Text style={[styles.macroLabel, { color: c.text.muted }]}>Protein</Text>
                    <Text style={[styles.macroCalories, { color: c.text.muted }]}>{macros.proteinG * 4} cal</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Text style={[styles.macroValue, { color: c.macro.carbs }]}>{macros.carbsG}g</Text>
                    <Text style={[styles.macroLabel, { color: c.text.muted }]}>Carbs</Text>
                    <Text style={[styles.macroCalories, { color: c.text.muted }]}>{macros.carbsG * 4} cal</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Text style={[styles.macroValue, { color: c.macro.fat }]}>{macros.fatG}g</Text>
                    <Text style={[styles.macroLabel, { color: c.text.muted }]}>Fat</Text>
                    <Text style={[styles.macroCalories, { color: c.text.muted }]}>{macros.fatG * 9} cal</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {onNext && <Button title="Continue" onPress={handleNext} style={styles.btn} />}
    </ScrollView>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  scroll: { paddingHorizontal: spacing[4], paddingBottom: spacing[8] },
  heading: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    marginBottom: spacing[2],
    lineHeight: typography.lineHeight['2xl'],
  },
  subheading: {
    fontSize: typography.size.base,
    marginBottom: spacing[4],
    lineHeight: typography.lineHeight.base,
  },
  calorieCard: {
    borderRadius: radius.md,
    borderWidth: 2,
    padding: spacing[4],
    marginBottom: spacing[4],
    alignItems: 'center',
  },
  calorieLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[1],
  },
  calorieValue: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.bold,
    fontVariant: ['tabular-nums'],
    marginBottom: spacing[1],
  },
  calorieNote: {
    fontSize: typography.size.xs,
    textAlign: 'center',
  },
  section: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  sectionTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.5,
    marginBottom: spacing[3],
    textTransform: 'uppercase',
  },
  proteinHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  proteinStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
    gap: spacing[3],
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
  },
  proteinDisplay: {
    alignItems: 'center',
    minWidth: 120,
  },
  proteinValue: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    fontVariant: ['tabular-nums'],
  },
  proteinDaily: {
    fontSize: typography.size.sm,
    marginTop: spacing[1],
  },
  recBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    marginBottom: spacing[2],
  },
  recBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[1],
  },
  sliderLabel: {
    fontSize: typography.size.xs,
  },
  proteinNote: {
    fontSize: typography.size.sm,
    marginTop: spacing[2],
    textAlign: 'center',
    lineHeight: typography.lineHeight.sm,
  },
  stylesContainer: {
    marginBottom: spacing[4],
  },
  styleCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  styleCardSelected: {
    borderWidth: 2,
  },
  styleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  styleTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  styleDesc: {
    fontSize: typography.size.sm,
    marginBottom: spacing[3],
    lineHeight: typography.lineHeight.sm,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: c.border.subtle,
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    fontVariant: ['tabular-nums'],
  },
  macroLabel: {
    fontSize: typography.size.xs,
    marginTop: spacing[0.5],
  },
  macroCalories: {
    fontSize: typography.size.xs,
    marginTop: spacing[0.5],
    fontVariant: ['tabular-nums'],
  },
  btn: { marginTop: spacing[4] },
});
