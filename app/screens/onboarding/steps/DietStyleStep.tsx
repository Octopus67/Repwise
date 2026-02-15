import { useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { colors, spacing, typography, radius } from '../../../theme/tokens';
import { Button } from '../../../components/common/Button';
import { useOnboardingStore, DietStyle, computeAge } from '../../../store/onboardingSlice';
import {
  computeTDEEBreakdown,
  computeCalorieBudget,
  computeMacroSplit,
  getProteinRecommendation,
} from '../../../utils/onboardingCalculations';

interface Props {
  onNext?: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  onComplete?: () => void;
  onEditStep?: (step: number) => void;
}

const DIET_STYLES: { type: DietStyle; title: string; desc: string }[] = [
  { type: 'balanced', title: 'Balanced', desc: 'Even split of carbs and fats' },
  { type: 'high_protein', title: 'High Protein', desc: 'Equal carbs and fats, extra protein emphasis' },
  { type: 'low_carb', title: 'Low Carb', desc: 'Mostly fats, fewer carbs' },
  { type: 'keto', title: 'Keto', desc: 'Very low carb, high fat' },
];

const TICK_WIDTH = 40;
const PROTEIN_MIN = 1.2;
const PROTEIN_MAX = 3.0;
const PROTEIN_STEP = 0.1;
const PROTEIN_TICK_COUNT = Math.round((PROTEIN_MAX - PROTEIN_MIN) / PROTEIN_STEP) + 1; // 19

export function DietStyleStep({ onNext }: Props) {
  const store = useOnboardingStore();
  const age = computeAge(store.birthYear, store.birthMonth);
  const goalType = store.goalType ?? 'maintain';
  const scrollRef = useRef<ScrollView>(null);

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
    () => computeCalorieBudget(tdee, goalType, store.rateKgPerWeek, store.sex).budget,
    [tdee, goalType, store.rateKgPerWeek, store.sex],
  );

  const proteinRec = useMemo(
    () => getProteinRecommendation(goalType, store.exerciseTypes.length > 0 ? store.exerciseTypes : ['strength']),
    [goalType, store.exerciseTypes],
  );

  const macros = useMemo(
    () => computeMacroSplit(budget, store.weightKg, store.proteinPerKg, store.dietStyle),
    [budget, store.weightKg, store.proteinPerKg, store.dietStyle],
  );

  // Precompute macros for each diet style card
  const styleMacros = useMemo(
    () =>
      DIET_STYLES.map((d) =>
        computeMacroSplit(budget, store.weightKg, store.proteinPerKg, d.type),
      ),
    [budget, store.weightKg, store.proteinPerKg],
  );

  // Protein scale ticks
  const proteinTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i < PROTEIN_TICK_COUNT; i++) {
      ticks.push(Math.round((PROTEIN_MIN + i * PROTEIN_STEP) * 10) / 10);
    }
    return ticks;
  }, []);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.x;
      const index = Math.round(offset / TICK_WIDTH);
      const clamped = Math.max(0, Math.min(index, PROTEIN_TICK_COUNT - 1));
      const value = Math.round((PROTEIN_MIN + clamped * PROTEIN_STEP) * 10) / 10;
      store.updateField('proteinPerKg', value);
    },
    [store],
  );

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.heading}>Diet Style</Text>
      <Text style={styles.subheading}>
        Choose your macro balance. Protein is set first from your body weight — these styles change how carbs and fat are split.
      </Text>

      {/* Diet style cards */}
      <View style={styles.cardsGrid}>
        {DIET_STYLES.map((d, idx) => {
          const selected = store.dietStyle === d.type;
          const sm = styleMacros[idx];
          const totalKcal = sm.proteinKcal + sm.carbsKcal + sm.fatKcal;
          const pFlex = totalKcal > 0 ? sm.proteinKcal / totalKcal : 0;
          const cFlex = totalKcal > 0 ? sm.carbsKcal / totalKcal : 0;
          const fFlex = totalKcal > 0 ? sm.fatKcal / totalKcal : 0;

          return (
            <TouchableOpacity
              key={d.type}
              style={[styles.card, selected && styles.cardSelected]}
              onPress={() => store.updateField('dietStyle', d.type)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>{d.title}</Text>
              <Text style={styles.cardDesc}>{d.desc}</Text>

              {/* Mini macro bar */}
              <View style={styles.miniBar}>
                <View style={[styles.miniBarSegment, { flex: pFlex, backgroundColor: colors.macro.protein, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }]} />
                <View style={[styles.miniBarSegment, { flex: cFlex, backgroundColor: colors.macro.carbs }]} />
                <View style={[styles.miniBarSegment, { flex: fFlex, backgroundColor: colors.macro.fat, borderTopRightRadius: 3, borderBottomRightRadius: 3 }]} />
              </View>

              <Text style={styles.miniBarLabel}>
                P: {sm.proteinG}g · C: {sm.carbsG}g · F: {sm.fatG}g
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Protein scale */}
      <Text style={styles.sectionLabel}>Protein per kg body weight</Text>
      <Text style={styles.proteinValueDisplay}>
        {store.proteinPerKg.toFixed(1)} g/kg · {Math.round(store.proteinPerKg * store.weightKg)}g/day
      </Text>

      <View style={styles.scaleContainer}>
        {/* Center indicator line */}
        <View style={styles.centerIndicator} />

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={TICK_WIDTH}
          decelerationRate="fast"
          contentContainerStyle={styles.scaleContent}
          onMomentumScrollEnd={handleScrollEnd}
          contentOffset={{ x: Math.round((store.proteinPerKg - PROTEIN_MIN) / PROTEIN_STEP) * TICK_WIDTH, y: 0 }}
        >
          {proteinTicks.map((val, i) => {
            const isMajor = Math.abs(val * 10 % 5) < 0.01;
            const inRange = proteinRec && val >= proteinRec.min && val <= proteinRec.max;
            return (
              <View key={i} style={styles.tickContainer}>
                {inRange && <View style={styles.tickRecommendedBg} />}
                <View
                  style={[
                    styles.tick,
                    isMajor ? styles.tickMajor : styles.tickNormal,
                  ]}
                />
                {isMajor && (
                  <Text style={styles.tickLabel}>{val.toFixed(1)}</Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>

      {proteinRec && (
        <Text style={styles.recHint}>
          Recommended: {proteinRec.min}–{proteinRec.max} g/kg
        </Text>
      )}

      {/* Protein info card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          Protein preserves muscle during fat loss and supports growth during bulking. The green zone is optimal for your goal and training style.
        </Text>
      </View>

      {/* Live macro display */}
      <View style={styles.macroCard}>
        <View style={styles.macroRow}>
          <View style={styles.macroItem}>
            <View style={[styles.macroDot, { backgroundColor: colors.macro.protein }]} />
            <Text style={styles.macroLabel}>Protein</Text>
            <Text style={styles.macroValue}>{macros.proteinG}g</Text>
          </View>
          <View style={styles.macroItem}>
            <View style={[styles.macroDot, { backgroundColor: colors.macro.carbs }]} />
            <Text style={styles.macroLabel}>Carbs</Text>
            <Text style={styles.macroValue}>{macros.carbsG}g</Text>
          </View>
          <View style={styles.macroItem}>
            <View style={[styles.macroDot, { backgroundColor: colors.macro.fat }]} />
            <Text style={styles.macroLabel}>Fat</Text>
            <Text style={styles.macroValue}>{macros.fatG}g</Text>
          </View>
        </View>
      </View>

      {onNext && <Button title="Next" onPress={onNext} style={styles.btn} />}
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing[8] },
  heading: {
    color: colors.text.primary,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    marginBottom: spacing[2],
  },
  subheading: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    marginBottom: spacing[6],
  },

  /* Diet style cards */
  cardsGrid: { marginBottom: spacing[6] },
  card: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  cardSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.primaryMuted,
  },
  cardTitle: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    marginBottom: 2,
  },
  cardTitleSelected: { color: colors.accent.primary },
  cardDesc: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    marginBottom: spacing[2],
  },
  miniBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing[1],
  },
  miniBarSegment: {
    height: 6,
  },
  miniBarLabel: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
  },

  /* Protein scale */
  sectionLabel: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[1],
  },
  proteinValueDisplay: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  scaleContainer: {
    height: 60,
    marginBottom: spacing[2],
    position: 'relative',
  },
  centerIndicator: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.accent.primary,
    zIndex: 10,
  },
  scaleContent: {
    paddingHorizontal: '50%',
    alignItems: 'flex-end',
  },
  tickContainer: {
    width: TICK_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 50,
    position: 'relative',
  },
  tickRecommendedBg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.semantic.positiveSubtle,
  },
  tick: {
    width: 2,
    backgroundColor: colors.text.muted,
  },
  tickNormal: {
    height: 20,
  },
  tickMajor: {
    height: 30,
  },
  tickLabel: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
    marginTop: 2,
  },
  recHint: {
    color: colors.semantic.positive,
    fontSize: typography.size.xs,
    marginBottom: spacing[3],
  },

  /* Protein info card */
  infoCard: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[6],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  infoText: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.relaxed,
  },

  /* Live macro display */
  macroCard: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[6],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  macroRow: { flexDirection: 'row', justifyContent: 'space-around' },
  macroItem: { alignItems: 'center' },
  macroDot: { width: 8, height: 8, borderRadius: 4, marginBottom: spacing[1] },
  macroLabel: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    marginBottom: 2,
  },
  macroValue: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  btn: { marginTop: spacing[2] },
});
