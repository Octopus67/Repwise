import { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedReaction, withTiming, withDelay, Easing, runOnJS, type SharedValue } from 'react-native-reanimated';
import { spacing, typography, radius, motion } from '../../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../../hooks/useThemeColors';
import { Button } from '../../../components/common/Button';
import { useOnboardingStore, computeAge } from '../../../store/onboardingSlice';
import { computeTDEEBreakdown } from '../../../utils/onboardingCalculations';
import { useReduceMotion } from '../../../hooks/useReduceMotion';
import { useCountingValue } from '../../../hooks/useCountingValue';
import { useStaggeredEntrance } from '../../../hooks/useStaggeredEntrance';

interface Props { onNext?: () => void; onBack?: () => void; onSkip?: () => void; onComplete?: () => void; onEditStep?: (step: number) => void; }

const BAR_LABELS = {
  bmr: { label: 'BMR', desc: 'Base metabolism' },
  neat: { label: 'Activity', desc: 'Daily movement' },
  eat: { label: 'Exercise', desc: 'Workout sessions' },
  tef: { label: 'TEF', desc: 'Digesting food' },
};

const BAR_DELAYS = { bmr: 200, neat: 350, eat: 500, tef: 650 };

// ─── Animated TDEE Text ──────────────────────────────────────────────────────

function AnimatedTDEEText({ value }: { value: SharedValue<number> }) {
  const c = useThemeColors();
  const s = getThemedStyles(c);
  const [display, setDisplay] = useState(0);
  useAnimatedReaction(
    () => Math.round(value.value),
    (cur) => runOnJS(setDisplay)(cur),
    [value],
  );
  return (
    <Text style={[s.totalValue, { color: c.text.primary }]}>~{display.toLocaleString()} kcal/day</Text>
  );
}

// ─── Animated Bar ────────────────────────────────────────────────────────────

function AnimatedBar({ widthPct, color, delay }: { widthPct: number; color: string; delay: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: motion.duration.slow, easing: Easing.out(Easing.ease) }));
  }, []);
  const animStyle = useAnimatedStyle(() => ({
    width: `${progress.value * widthPct}%`,
    backgroundColor: color,
  }));
  return <Animated.View style={[{ height: '100%', borderRadius: radius.sm }, animStyle]} />;
}

export function TDEERevealStep({ onNext }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const store = useOnboardingStore();
  const reduceMotion = useReduceMotion();
  const [showOverride, setShowOverride] = useState(false);
  const [overrideText, setOverrideText] = useState(
    store.tdeeOverride ? String(store.tdeeOverride) : '',
  );

  const barColors = {
    bmr: c.accent.primary,
    neat: c.semantic.positive,
    eat: c.semantic.warning,
    tef: c.chart.calories,
  };

  const age = computeAge(store.birthYear, store.birthMonth);

  const breakdown = useMemo(
    () =>
      store.sex ? computeTDEEBreakdown(
        store.weightKg,
        store.heightCm,
        age,
        store.sex,
        store.activityLevel,
        store.exerciseSessionsPerWeek,
        store.exerciseTypes.length > 0 ? store.exerciseTypes : ['strength'],
        store.bodyFatPct ?? undefined,
      ) : { bmr: 0, neat: 0, eat: 0, tef: 0, total: 0 },
    [store.weightKg, store.heightCm, age, store.sex, store.activityLevel, store.exerciseSessionsPerWeek, store.exerciseTypes, store.bodyFatPct],
  );

  const effectiveTDEE = store.tdeeOverride ?? breakdown.total;
  const animatedTDEE = useCountingValue(effectiveTDEE, 600);

  const components: { key: 'bmr' | 'neat' | 'eat' | 'tef'; value: number }[] = [
    { key: 'bmr', value: breakdown.bmr || 0 },
    { key: 'neat', value: breakdown.neat || 0 },
    { key: 'eat', value: breakdown.eat || 0 },
    { key: 'tef', value: breakdown.tef || 0 },
  ];

  const maxVal = Math.max(...components.map((comp) => comp.value), 1);

  const headingAnim = useStaggeredEntrance(0);
  const totalCardAnim = useStaggeredEntrance(1);
  const barsAnim = useStaggeredEntrance(2);

  const handleOverrideSubmit = () => {
    const parsed = parseInt(overrideText, 10);
    if (parsed && parsed > 0) {
      store.updateField('tdeeOverride', parsed);
    } else {
      store.updateField('tdeeOverride', null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Animated.View style={headingAnim}>
        <Text style={[styles.heading, { color: c.text.primary }]}>Your Daily Energy</Text>
        <Text style={[styles.subheading, { color: c.text.secondary }]}>Here's how your body uses calories each day</Text>
      </Animated.View>

      {/* Total TDEE */}
      <Animated.View style={[styles.totalCard, totalCardAnim]}>
        <Text style={[styles.totalLabel, { color: c.text.secondary }]}>Your body burns</Text>
        {reduceMotion ? (
          <Text style={[styles.totalValue, { color: c.text.primary }]}>~{effectiveTDEE.toLocaleString()} kcal/day</Text>
        ) : (
          <AnimatedTDEEText value={animatedTDEE} />
        )}
      </Animated.View>

      {/* Stacked bars */}
      <Animated.View style={[styles.barsContainer, barsAnim]}>
        {components.map(({ key, value }) => {
          const widthPct = Math.max(8, (value / maxVal) * 100);
          return (
            <View key={key} style={styles.barRow}>
              <View style={styles.barLabelCol}>
                <Text style={[styles.barLabel, { color: c.text.secondary }]}>{BAR_LABELS[key].label}</Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: c.bg.surface }]}>
                {reduceMotion ? (
                  <View style={[styles.barFill, { width: `${widthPct}%`, backgroundColor: barColors[key] }]} />
                ) : (
                  <AnimatedBar widthPct={widthPct} color={barColors[key]} delay={BAR_DELAYS[key]} />
                )}
              </View>
              <View style={styles.barValueCol}>
                <Text style={[styles.barValue, { color: c.text.primary }]}>{value.toLocaleString()}</Text>
                <Text style={[styles.barDesc, { color: c.text.muted }]}>{BAR_LABELS[key].desc}</Text>
              </View>
            </View>
          );
        })}
      </Animated.View>

      {/* Override link */}
      {!showOverride ? (
        <TouchableOpacity onPress={() => setShowOverride(true)} style={styles.overrideLink} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.overrideLinkText, { color: c.accent.primary }]}>I already know my TDEE</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.overrideContainer}>
          <Text style={[styles.overrideLabel, { color: c.text.secondary }]}>Enter your known TDEE (kcal/day)</Text>
          <TextInput
            style={[styles.overrideInput, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}
            value={overrideText}
            onChangeText={setOverrideText}
            onBlur={handleOverrideSubmit}
            keyboardType="numeric"
            placeholder="e.g. 2500"
            placeholderTextColor={c.text.muted}
            returnKeyType="done"
            onSubmitEditing={handleOverrideSubmit}
            accessibilityLabel="TDEE override"
            accessibilityHint="Enter your known daily calorie expenditure"
          />
          {store.tdeeOverride && (
            <TouchableOpacity
              onPress={() => {
                store.updateField('tdeeOverride', null);
                setOverrideText('');
                setShowOverride(false);
              }}
            >
              <Text style={[styles.clearOverride, { color: c.semantic.negative }]}>Clear override</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: c.border.default }]} />

      {/* Smart Training comparison */}
      <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Smart Training</Text>
      <View style={styles.comparisonGrid}>
        <View style={[styles.compCard, { backgroundColor: c.bg.surface, borderColor: c.border.subtle, opacity: 0.7 }]}>
          <Text style={[styles.compCardTitle, { color: c.text.secondary }]}>Static Plans</Text>
          <View style={[styles.compCardDivider, { backgroundColor: c.border.default }]} />
          <Text style={[styles.compCardItem, { color: c.text.muted }]}>Same volume every week</Text>
          <Text style={[styles.compCardItem, { color: c.text.muted }]}>Ignores calorie intake</Text>
          <Text style={[styles.compCardItem, { color: c.text.muted }]}>No recovery adjustment</Text>
          <View style={styles.spacerSm} />
          <Text style={[styles.compCardResult, { color: c.semantic.negative }]}>Risk: Overtraining or plateau</Text>
        </View>
        <View style={[styles.compCard, { backgroundColor: c.bg.surfaceRaised, borderColor: c.accent.primary, borderWidth: 2 }]}>
          <Text style={[styles.compCardTitle, { color: c.accent.primary }]}>Repwise Adaptive</Text>
          <View style={[styles.compCardDivider, { backgroundColor: c.accent.primary }]} />
          <Text style={[styles.compCardItem, { color: c.text.secondary }]}>Adjusts weekly</Text>
          <Text style={[styles.compCardItem, { color: c.text.secondary }]}>Matches your calories</Text>
          <Text style={[styles.compCardItem, { color: c.text.secondary }]}>Responds to recovery</Text>
          <View style={styles.spacerSm} />
          <Text style={[styles.compCardResult, { color: c.semantic.positive }]}>Result: Optimal progress</Text>
        </View>
      </View>

      {/* Educational note */}
      <Text style={[styles.note, { color: c.text.muted }]}>
        This will get more accurate as you log food and weight
      </Text>

      {onNext && <Button title="Next" onPress={onNext} style={styles.btn} />}
    </ScrollView>
  );
}


const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  scroll: { paddingBottom: spacing[8] },
  heading: { color: c.text.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, marginBottom: spacing[2], lineHeight: typography.lineHeight['2xl'] },
  subheading: { color: c.text.secondary, fontSize: typography.size.base, marginBottom: spacing[6], lineHeight: typography.lineHeight.base },
  totalCard: {
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing[5],
    alignItems: 'center',
    marginBottom: spacing[6],
    borderWidth: 1,
    borderColor: c.border.default,
  },
  totalLabel: { color: c.text.secondary, fontSize: typography.size.sm, marginBottom: spacing[1], lineHeight: typography.lineHeight.sm },
  totalValue: { color: c.text.primary, fontSize: typography.size['3xl'], fontWeight: typography.weight.bold, lineHeight: typography.lineHeight['3xl'] },
  barsContainer: { marginBottom: spacing[5] },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  barLabelCol: { width: 64 },
  barLabel: { color: c.text.secondary, fontSize: typography.size.sm, fontWeight: typography.weight.medium, lineHeight: typography.lineHeight.sm },
  barTrack: {
    flex: 1,
    height: 24,
    backgroundColor: c.bg.surface,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginHorizontal: spacing[2],
  },
  barFill: { height: '100%', borderRadius: radius.sm },
  barValueCol: { width: 80, alignItems: 'flex-end' },
  barValue: { color: c.text.primary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold, lineHeight: typography.lineHeight.sm },
  barDesc: { color: c.text.muted, fontSize: typography.size.xs, lineHeight: typography.lineHeight.xs },
  overrideLink: { alignItems: 'center', marginBottom: spacing[4] },
  overrideLinkText: { color: c.accent.primary, fontSize: typography.size.sm, textDecorationLine: 'underline', lineHeight: typography.lineHeight.sm },
  overrideContainer: { marginBottom: spacing[4] },
  overrideLabel: { color: c.text.secondary, fontSize: typography.size.sm, marginBottom: spacing[2], lineHeight: typography.lineHeight.sm },
  overrideInput: {
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border.default,
    color: c.text.primary,
    fontSize: typography.size.md,
    padding: spacing[3],
    marginBottom: spacing[2],
    lineHeight: typography.lineHeight.md,
  },
  clearOverride: { color: c.semantic.negative, fontSize: typography.size.sm, textAlign: 'center', lineHeight: typography.lineHeight.sm },
  note: { color: c.text.muted, fontSize: typography.size.xs, textAlign: 'center', marginBottom: spacing[6], lineHeight: typography.lineHeight.xs },
  divider: { height: 1, marginVertical: spacing[5] },
  sectionTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, marginBottom: spacing[3], lineHeight: typography.lineHeight.lg },
  comparisonGrid: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] },
  compCard: { flex: 1, borderRadius: radius.md, borderWidth: 1, padding: spacing[4] },
  compCardTitle: { fontSize: typography.size.base, fontWeight: typography.weight.bold, marginBottom: spacing[2], textAlign: 'center' },
  compCardDivider: { height: 2, marginBottom: spacing[3] },
  compCardItem: { fontSize: typography.size.sm, marginBottom: spacing[1], lineHeight: typography.lineHeight.sm },
  compCardResult: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, marginTop: spacing[2], lineHeight: typography.lineHeight.sm },
  btn: { marginTop: spacing[2] },
  spacerSm: { height: spacing[2] },
});
