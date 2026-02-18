import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Dimensions,
} from 'react-native';
import { colors, spacing, typography, radius } from '../../../theme/tokens';
import { useOnboardingStore, computeAge } from '../../../store/onboardingSlice';
import { computeBMR } from '../../../utils/onboardingCalculations';
import { Button } from '../../../components/common/Button';

interface Props {
  onNext?: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  onComplete?: () => void;
  onEditStep?: (step: number) => void;
}

// ─── Horizontal scale constants ──────────────────────────────────────────────
const TICK_WIDTH = 12;
const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Unit conversion helpers ─────────────────────────────────────────────────

function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

function lbsToKg(lbs: number): number {
  return Math.round((lbs / 2.20462) * 10) / 10;
}

// ─── Horizontal Scale Component ──────────────────────────────────────────────

interface ScaleProps {
  min: number;
  max: number;
  step: number;
  value: number;
  unit: string;
  formatLabel: (val: number) => string;
  onValueChange: (val: number) => void;
}

function HorizontalScale({ min, max, step, value, unit, formatLabel, onValueChange }: ScaleProps) {
  const scrollRef = useRef<ScrollView>(null);
  const displayValueRef = useRef(value);
  const [displayValue, setDisplayValue] = useState(value);

  const steps = useMemo(() => {
    const arr: number[] = [];
    for (let v = min; v <= max; v = Math.round((v + step) * 100) / 100) arr.push(v);
    return arr;
  }, [min, max, step]);

  const totalTicks = steps.length;
  const halfScreen = SCREEN_WIDTH / 2;

  const resolveValue = useCallback(
    (offsetX: number) => {
      const index = Math.round(offsetX / TICK_WIDTH);
      const clamped = Math.max(0, Math.min(index, totalTicks - 1));
      return steps[clamped];
    },
    [totalTicks, steps],
  );

  // Commit to store on scroll end (drag end or momentum end)
  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const val = resolveValue(e.nativeEvent.contentOffset.x);
      displayValueRef.current = val;
      setDisplayValue(val);
      onValueChange(val);
    },
    [resolveValue, onValueChange],
  );

  // Update local display AND commit to store during scroll
  // This ensures BMR and other derived values update in real-time
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const val = resolveValue(e.nativeEvent.contentOffset.x);
      if (val !== displayValueRef.current) {
        displayValueRef.current = val;
        setDisplayValue(val);
        onValueChange(val);
      }
    },
    [resolveValue, onValueChange],
  );

  // Scroll to initial value on mount
  useEffect(() => {
    const index = steps.findIndex((s) => s >= value);
    const targetIndex = index >= 0 ? index : 0;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: targetIndex * TICK_WIDTH, animated: false });
    }, 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max, step]);

  return (
    <View style={scaleStyles.wrapper}>
      <Text style={scaleStyles.valueDisplay}>
        {formatLabel(displayValue)} <Text style={scaleStyles.unitText}>{unit}</Text>
      </Text>
      <View style={scaleStyles.rulerContainer}>
        <View style={scaleStyles.fadeLeft} pointerEvents="none" />
        <View style={scaleStyles.fadeRight} pointerEvents="none" />
        <View style={scaleStyles.centerLine} />
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={TICK_WIDTH}
          decelerationRate="fast"
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          onScroll={handleScroll}
          scrollEventThrottle={32}
          contentContainerStyle={{ paddingHorizontal: halfScreen }}
        >
          {steps.map((val, i) => {
            const isFifth = i % 5 === 0;
            const isTenth = i % 10 === 0;
            return (
              <View key={i} style={scaleStyles.tickContainer}>
                <View
                  style={[
                    scaleStyles.tick,
                    { height: isFifth ? 24 : 16 },
                    isFifth && scaleStyles.tickMajor,
                  ]}
                />
                {isTenth && (
                  <Text style={scaleStyles.tickLabel}>
                    {step < 1 ? val.toFixed(0) : Math.round(val)}
                  </Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const scaleStyles = StyleSheet.create({
  wrapper: {
    marginTop: spacing[2],
  },
  valueDisplay: {
    textAlign: 'center',
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    marginBottom: spacing[2],
    fontVariant: ['tabular-nums'],
    lineHeight: typography.lineHeight['2xl'],
  },
  unitText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    color: colors.text.secondary,
    lineHeight: typography.lineHeight.md,
  },
  rulerContainer: {
    height: 56,
    overflow: 'hidden',
    position: 'relative',
  },
  fadeLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 40,
    backgroundColor: colors.bg.base,
    opacity: 0.7,
    zIndex: 5,
  },
  fadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
    backgroundColor: colors.bg.base,
    opacity: 0.7,
    zIndex: 5,
  },
  centerLine: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.accent.primary,
    zIndex: 10,
    marginLeft: -1,
  },
  tickContainer: {
    width: TICK_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  tick: {
    width: 1,
    backgroundColor: colors.border.default,
  },
  tickMajor: {
    width: 1.5,
    backgroundColor: colors.text.muted,
  },
  tickLabel: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    marginTop: spacing[0.5],
    fontVariant: ['tabular-nums'],
    lineHeight: typography.lineHeight.xs,
  },
});

// ─── Main Component ──────────────────────────────────────────────────────────

export function BodyMeasurementsStep({ onNext }: Props) {
  const {
    sex,
    birthYear,
    birthMonth,
    heightCm,
    weightKg,
    unitSystem,
    bodyFatPct,
    updateField,
  } = useOnboardingStore();

  // Live BMR calculation
  const age = computeAge(birthYear, birthMonth);
  const liveBMR = useMemo(() => {
    if (heightCm <= 0 || weightKg <= 0) return 0;
    return computeBMR(weightKg, heightCm, age, sex, bodyFatPct ?? undefined);
  }, [weightKg, heightCm, age, sex, bodyFatPct]);

  // ─── Height / Weight scale config ──────────────────────────────────────

  const heightConfig = useMemo(() => {
    if (unitSystem === 'metric') {
      return { min: 100, max: 250, step: 1, unit: 'cm', format: (v: number) => String(Math.round(v)) };
    }
    return {
      min: 39, max: 98, step: 1, unit: '',
      format: (v: number) => {
        const ft = Math.floor(v / 12);
        const inches = Math.round(v % 12);
        return `${ft}'${inches}"`;
      },
    };
  }, [unitSystem]);

  const heightValue = useMemo(() => {
    if (unitSystem === 'imperial') return Math.round(heightCm / 2.54);
    return heightCm;
  }, [heightCm, unitSystem]);

  const handleHeightChange = useCallback(
    (val: number) => {
      if (unitSystem === 'imperial') {
        updateField('heightCm', Math.round(val * 2.54));
      } else {
        updateField('heightCm', Math.round(val));
      }
    },
    [unitSystem, updateField],
  );

  const weightConfig = useMemo(() => {
    if (unitSystem === 'metric') {
      return { min: 30, max: 300, step: 0.5, unit: 'kg', format: (v: number) => v.toFixed(1) };
    }
    return { min: 66, max: 661, step: 1, unit: 'lbs', format: (v: number) => String(Math.round(v)) };
  }, [unitSystem]);

  const weightValue = useMemo(() => {
    if (unitSystem === 'imperial') return Math.round(kgToLbs(weightKg));
    return weightKg;
  }, [weightKg, unitSystem]);

  const handleWeightChange = useCallback(
    (val: number) => {
      if (unitSystem === 'imperial') {
        updateField('weightKg', lbsToKg(val));
      } else {
        updateField('weightKg', val);
      }
    },
    [unitSystem, updateField],
  );

  const toggleUnits = useCallback(() => {
    updateField('unitSystem', unitSystem === 'metric' ? 'imperial' : 'metric');
  }, [unitSystem, updateField]);

  const canProceed = heightCm > 0 && weightKg > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Measurements</Text>
      <Text style={styles.subtitle}>Height and weight help us dial in your metabolism</Text>

      {/* ── Height — horizontal scroll scale ─────────────────────────── */}
      <View style={styles.fieldRow}>
        <Text style={styles.label}>Height</Text>
        <TouchableOpacity onPress={toggleUnits} style={styles.unitToggle}>
          <Text style={styles.unitToggleText}>
            {unitSystem === 'metric' ? 'cm → ft/in' : 'ft/in → cm'}
          </Text>
        </TouchableOpacity>
      </View>
      <HorizontalScale
        min={heightConfig.min}
        max={heightConfig.max}
        step={heightConfig.step}
        value={heightValue}
        unit={heightConfig.unit}
        formatLabel={heightConfig.format}
        onValueChange={handleHeightChange}
      />

      {/* ── Weight — horizontal scroll scale ─────────────────────────── */}
      <View style={styles.fieldRow}>
        <Text style={styles.label}>Weight</Text>
        <TouchableOpacity onPress={toggleUnits} style={styles.unitToggle}>
          <Text style={styles.unitToggleText}>
            {unitSystem === 'metric' ? 'kg → lbs' : 'lbs → kg'}
          </Text>
        </TouchableOpacity>
      </View>
      <HorizontalScale
        min={weightConfig.min}
        max={weightConfig.max}
        step={weightConfig.step}
        value={weightValue}
        unit={weightConfig.unit}
        formatLabel={weightConfig.format}
        onValueChange={handleWeightChange}
      />

      {/* ── Live BMR display ─────────────────────────────────────────── */}
      {liveBMR > 0 && (
        <View style={styles.bmrCard}>
          <Text style={styles.bmrLabel}>Your BMR</Text>
          <Text style={styles.bmrValue}>~{liveBMR.toLocaleString()} kcal/day</Text>
          <Text style={styles.bmrHint}>Calories your body burns at rest</Text>
        </View>
      )}

      {onNext && (
        <Button title="Next" onPress={onNext} disabled={!canProceed} style={styles.nextBtn} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: spacing[4], paddingBottom: spacing[10] },
  title: { color: colors.text.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, marginBottom: spacing[1], lineHeight: typography.lineHeight['2xl'] },
  subtitle: { color: colors.text.secondary, fontSize: typography.size.base, marginBottom: spacing[6], lineHeight: typography.lineHeight.base },
  label: { color: colors.text.secondary, fontSize: typography.size.sm, fontWeight: typography.weight.medium, marginBottom: spacing[2], marginTop: spacing[4], lineHeight: typography.lineHeight.sm },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing[4], marginBottom: spacing[2] },
  unitToggle: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full, backgroundColor: colors.accent.primaryMuted },
  unitToggleText: { color: colors.accent.primary, fontSize: typography.size.xs, fontWeight: typography.weight.semibold, lineHeight: typography.lineHeight.xs },
  bmrCard: { backgroundColor: colors.bg.surfaceRaised, borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent.primaryMuted, padding: spacing[4], marginTop: spacing[6], alignItems: 'center' },
  bmrLabel: { color: colors.text.secondary, fontSize: typography.size.sm, fontWeight: typography.weight.medium, lineHeight: typography.lineHeight.sm },
  bmrValue: { color: colors.accent.primary, fontSize: typography.size.xl, fontWeight: typography.weight.bold, marginTop: spacing[1], fontVariant: ['tabular-nums'], lineHeight: typography.lineHeight.xl },
  bmrHint: { color: colors.text.muted, fontSize: typography.size.xs, marginTop: spacing[1], lineHeight: typography.lineHeight.xs },
  nextBtn: { marginTop: spacing[6], width: '100%' },
});
