import { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedReaction, withTiming, withDelay, Easing, runOnJS, type SharedValue } from 'react-native-reanimated';
import { colors, spacing, typography, radius, motion } from '../../../theme/tokens';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { Button } from '../../../components/common/Button';
import { useOnboardingStore, computeAge } from '../../../store/onboardingSlice';
import { computeTDEEBreakdown } from '../../../utils/onboardingCalculations';
import { useReduceMotion } from '../../../hooks/useReduceMotion';
import { useCountingValue } from '../../../hooks/useCountingValue';
import { useStaggeredEntrance } from '../../../hooks/useStaggeredEntrance';

interface Props { onNext?: () => void; onBack?: () => void; onSkip?: () => void; onComplete?: () => void; onEditStep?: (step: number) => void; }

const BAR_COLORS = {
  bmr: colors.accent.primary,
  neat: colors.semantic.positive,
  eat: colors.semantic.warning,
  tef: colors.chart.calories,
};

const BAR_LABELS = {
  bmr: { label: 'BMR', desc: 'Base metabolism' },
  neat: { label: 'Activity', desc: 'Daily movement' },
  eat: { label: 'Exercise', desc: 'Workout sessions' },
  tef: { label: 'TEF', desc: 'Digesting food' },
};

const BAR_DELAYS = { bmr: 200, neat: 350, eat: 500, tef: 650 };

// ─── Animated TDEE Text ──────────────────────────────────────────────────────

function AnimatedTDEEText({ value }: { value: SharedValue<number> }) {
  const [display, setDisplay] = useState(0);
  useAnimatedReaction(
    () => Math.round(value.value),
    (cur) => runOnJS(setDisplay)(cur),
    [value],
  );
  return (
    <Text style={[styles.totalValue, { color: colors.text.primary }]}>~{display.toLocaleString()} kcal/day</Text>
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
  return <Animated.View style={[styles.barFill, animStyle]} />;
}

export function TDEERevealStep({ onNext }: Props) {
  const c = useThemeColors();
  const store = useOnboardingStore();
  const reduceMotion = useReduceMotion();
  const [showOverride, setShowOverride] = useState(false);
  const [overrideText, setOverrideText] = useState(
    store.tdeeOverride ? String(store.tdeeOverride) : '',
  );

  const age = computeAge(store.birthYear, store.birthMonth);

  const breakdown = useMemo(
    () =>
      computeTDEEBreakdown(
        store.weightKg,
        store.heightCm,
        age,
        store.sex,
        store.activityLevel,
        store.exerciseSessionsPerWeek,
        store.exerciseTypes.length > 0 ? store.exerciseTypes : ['strength'],
        store.bodyFatPct ?? undefined,
      ),
    [store.weightKg, store.heightCm, age, store.sex, store.activityLevel, store.exerciseSessionsPerWeek, store.exerciseTypes, store.bodyFatPct],
  );

  const effectiveTDEE = store.tdeeOverride ?? breakdown.total;
  const animatedTDEE = useCountingValue(effectiveTDEE, 600);

  const components: { key: 'bmr' | 'neat' | 'eat' | 'tef'; value: number }[] = [
    { key: 'bmr', value: breakdown.bmr },
    { key: 'neat', value: breakdown.neat },
    { key: 'eat', value: breakdown.eat },
    { key: 'tef', value: breakdown.tef },
  ];

  const maxVal = Math.max(...components.map((c) => c.value), 1);

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
                  <View style={[styles.barFill, { width: `${widthPct}%`, backgroundColor: BAR_COLORS[key] }]} />
                ) : (
                  <AnimatedBar widthPct={widthPct} color={BAR_COLORS[key]} delay={BAR_DELAYS[key]} />
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

      {/* Educational note */}
      <Text style={[styles.note, { color: c.text.muted }]}>
        This will get more accurate as you log food and weight
      </Text>

      {onNext && <Button title="Next" onPress={onNext} style={styles.btn} />}
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing[8] },
  heading: { color: colors.text.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, marginBottom: spacing[2], lineHeight: typography.lineHeight['2xl'] },
  subheading: { color: colors.text.secondary, fontSize: typography.size.base, marginBottom: spacing[6], lineHeight: typography.lineHeight.base },
  totalCard: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing[5],
    alignItems: 'center',
    marginBottom: spacing[6],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  totalLabel: { color: colors.text.secondary, fontSize: typography.size.sm, marginBottom: spacing[1], lineHeight: typography.lineHeight.sm },
  totalValue: { color: colors.text.primary, fontSize: typography.size['3xl'], fontWeight: typography.weight.bold, lineHeight: typography.lineHeight['3xl'] },
  barsContainer: { marginBottom: spacing[5] },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  barLabelCol: { width: 64 },
  barLabel: { color: colors.text.secondary, fontSize: typography.size.sm, fontWeight: typography.weight.medium, lineHeight: typography.lineHeight.sm },
  barTrack: {
    flex: 1,
    height: 24,
    backgroundColor: colors.bg.surface,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginHorizontal: spacing[2],
  },
  barFill: { height: '100%', borderRadius: radius.sm },
  barValueCol: { width: 80, alignItems: 'flex-end' },
  barValue: { color: colors.text.primary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold, lineHeight: typography.lineHeight.sm },
  barDesc: { color: colors.text.muted, fontSize: typography.size.xs, lineHeight: typography.lineHeight.xs },
  overrideLink: { alignItems: 'center', marginBottom: spacing[4] },
  overrideLinkText: { color: colors.accent.primary, fontSize: typography.size.sm, textDecorationLine: 'underline', lineHeight: typography.lineHeight.sm },
  overrideContainer: { marginBottom: spacing[4] },
  overrideLabel: { color: colors.text.secondary, fontSize: typography.size.sm, marginBottom: spacing[2], lineHeight: typography.lineHeight.sm },
  overrideInput: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    color: colors.text.primary,
    fontSize: typography.size.md,
    padding: spacing[3],
    marginBottom: spacing[2],
    lineHeight: typography.lineHeight.md,
  },
  clearOverride: { color: colors.semantic.negative, fontSize: typography.size.sm, textAlign: 'center', lineHeight: typography.lineHeight.sm },
  note: { color: colors.text.muted, fontSize: typography.size.xs, textAlign: 'center', marginBottom: spacing[6], lineHeight: typography.lineHeight.xs },
  btn: { marginTop: spacing[2] },
});
