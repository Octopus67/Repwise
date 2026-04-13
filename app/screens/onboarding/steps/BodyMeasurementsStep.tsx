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
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import { spacing, typography, radius } from '../../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../../hooks/useThemeColors';
import { useOnboardingStore, computeAge } from '../../../store/onboardingSlice';
import { computeBMR } from '../../../utils/onboardingCalculations';
import { Button } from '../../../components/common/Button';
import { useHaptics } from '../../../hooks/useHaptics';
import { useCountingValue } from '../../../hooks/useCountingValue';

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
  const c = useThemeColors();
  const sStyles = getScaleStyles(c);
  const scrollRef = useRef<ScrollView>(null);
  const displayValueRef = useRef(value);
  const [displayValue, setDisplayValue] = useState(value);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editText, setEditText] = useState('');

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

  // Scroll to a specific value
  const scrollToValue = useCallback(
    (targetVal: number) => {
      const index = steps.findIndex((s) => s >= targetVal);
      const targetIndex = index >= 0 ? index : steps.length - 1;
      scrollRef.current?.scrollTo({ x: targetIndex * TICK_WIDTH, animated: true });
      displayValueRef.current = steps[targetIndex];
      setDisplayValue(steps[targetIndex]);
      onValueChange(steps[targetIndex]);
    },
    [steps, onValueChange],
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

  // Tap-to-edit: open numeric input overlay
  const handleTapValue = useCallback(() => {
    setEditText(step < 1 ? displayValue.toFixed(1) : String(Math.round(displayValue)));
    setEditModalVisible(true);
  }, [displayValue, step]);

  const handleEditSubmit = useCallback(() => {
    const parsed = parseFloat(editText);
    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
      // Snap to nearest step
      const snapped = Math.round(parsed / step) * step;
      const clamped = Math.max(min, Math.min(max, Math.round(snapped * 100) / 100));
      scrollToValue(clamped);
    }
    setEditModalVisible(false);
  }, [editText, min, max, step, scrollToValue]);

  return (
    <View style={sStyles.wrapper}>
      <TouchableOpacity onPress={handleTapValue} activeOpacity={0.6} accessibilityLabel={`Tap to enter exact ${unit} value`} accessibilityRole="button">
        <Text style={sStyles.valueDisplay}>
          {formatLabel(displayValue)} <Text style={sStyles.unitText}>{unit}</Text>
        </Text>
      </TouchableOpacity>

      {/* Numeric input overlay */}
      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <TouchableOpacity style={sStyles.modalOverlay} activeOpacity={1} onPress={() => setEditModalVisible(false)}>
          <View style={sStyles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={sStyles.modalTitle}>Enter exact value</Text>
            <TextInput
              style={sStyles.modalInput}
              value={editText}
              onChangeText={setEditText}
              keyboardType="decimal-pad"
              autoFocus
              selectTextOnFocus
              onSubmitEditing={handleEditSubmit}
              accessibilityLabel={`Exact ${unit} value`}
            />
            <View style={sStyles.modalButtons}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={sStyles.modalCancelBtn}>
                <Text style={sStyles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleEditSubmit} style={sStyles.modalConfirmBtn}>
                <Text style={sStyles.modalConfirmText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={sStyles.rulerContainer}>
        <View style={sStyles.fadeLeft} pointerEvents="none" />
        <View style={sStyles.fadeRight} pointerEvents="none" />
        <View style={sStyles.centerLine} />
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
              <View key={i} style={sStyles.tickContainer}>
                <View
                  style={[
                    sStyles.tick,
                    { height: isFifth ? 24 : 16 },
                    isFifth && sStyles.tickMajor,
                  ]}
                />
                {isTenth && (
                  <Text style={sStyles.tickLabel}>
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

const getScaleStyles = (c: ThemeColors) => StyleSheet.create({
  wrapper: {
    marginTop: spacing[2],
  },
  valueDisplay: {
    textAlign: 'center',
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: c.text.primary,
    marginBottom: spacing[2],
    fontVariant: ['tabular-nums'],
    lineHeight: typography.lineHeight['2xl'],
  },
  unitText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    color: c.text.secondary,
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
    backgroundColor: c.bg.base,
    opacity: 0.7,
    zIndex: 5,
  },
  fadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
    backgroundColor: c.bg.base,
    opacity: 0.7,
    zIndex: 5,
  },
  centerLine: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: c.accent.primary,
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
    backgroundColor: c.border.default,
  },
  tickMajor: {
    width: 1.5,
    backgroundColor: c.text.muted,
  },
  tickLabel: {
    fontSize: typography.size.xs,
    color: c.text.muted,
    marginTop: spacing[0.5],
    fontVariant: ['tabular-nums'],
    lineHeight: typography.lineHeight.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing[5],
    width: 260,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: c.text.primary,
    marginBottom: spacing[3],
  },
  modalInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: c.border.default,
    borderRadius: radius.sm,
    padding: spacing[3],
    fontSize: typography.size.lg,
    color: c.text.primary,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: spacing[4],
    gap: spacing[3],
  },
  modalCancelBtn: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },
  modalCancelText: {
    color: c.text.muted,
    fontSize: typography.size.base,
  },
  modalConfirmBtn: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    backgroundColor: c.accent.primary,
    borderRadius: radius.sm,
  },
  modalConfirmText: {
    color: c.text.onAccent,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
});

// ─── Main Component ──────────────────────────────────────────────────────────

export function BodyMeasurementsStep({ onNext, onSkip }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
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
  const { impact } = useHaptics();

  // Live BMR calculation
  const age = computeAge(birthYear, birthMonth);
  const liveBMR = useMemo(() => {
    if (heightCm <= 0 || weightKg <= 0 || !sex) return 0;
    return computeBMR(weightKg, heightCm, age, sex, bodyFatPct ?? undefined);
  }, [weightKg, heightCm, age, sex, bodyFatPct]);

  // Animated BMR counting
  const animatedBMR = useCountingValue(liveBMR, 400);
  const [displayBMR, setDisplayBMR] = useState(liveBMR);
  useAnimatedReaction(
    () => Math.round(animatedBMR.value),
    (cur) => runOnJS(setDisplayBMR)(cur),
    [animatedBMR],
  );

  // Validation
  const heightValid = heightCm >= 100 && heightCm <= 250;
  const weightValid = weightKg >= 30 && weightKg <= 300;

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
        updateField('heightCm', Math.round(val * 2.54 * 10000) / 10000); // Higher precision
      } else {
        updateField('heightCm', Math.round(val * 10000) / 10000); // Higher precision
      }
    },
    [unitSystem, updateField],
  );

  const weightConfig = useMemo(() => {
    if (unitSystem === 'metric') {
      return { min: 30, max: 300, step: 0.5, unit: 'kg', format: (v: number) => v.toFixed(1) };
    }
    return { min: 66, max: 661, step: 0.5, unit: 'lbs', format: (v: number) => v.toFixed(1) };
  }, [unitSystem]);

  const weightValue = useMemo(() => {
    if (unitSystem === 'imperial') return Math.round(kgToLbs(weightKg) * 2) / 2; // snap to 0.5
    return weightKg;
  }, [weightKg, unitSystem]);

  const handleWeightChange = useCallback(
    (val: number) => {
      if (unitSystem === 'imperial') {
        updateField('weightKg', Math.round(lbsToKg(val) * 10000) / 10000); // Higher precision
      } else {
        updateField('weightKg', Math.round(val * 10000) / 10000); // Higher precision
      }
    },
    [unitSystem, updateField],
  );

  const toggleUnits = useCallback(() => {
    impact('light');
    updateField('unitSystem', unitSystem === 'metric' ? 'imperial' : 'metric');
  }, [unitSystem, updateField, impact]);

  const canProceed = heightCm > 0 && weightKg > 0 && heightValid && weightValid;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { color: c.text.primary }]}>Measurements</Text>
      <Text style={[styles.subtitle, { color: c.text.secondary }]}>Height and weight help us dial in your metabolism</Text>

      {/* ── Height — horizontal scroll scale ─────────────────────────── */}
      <View style={styles.fieldRow}>
        <Text style={[styles.label, { color: c.text.secondary }]}>Height</Text>
        <TouchableOpacity onPress={toggleUnits} style={[styles.unitToggle, { backgroundColor: c.accent.primaryMuted }]} accessibilityLabel="Toggle units" accessibilityRole="button">
          <Text style={[styles.unitToggleText, { color: c.accent.primary }]}>
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
      {!heightValid && (
        <Text style={[styles.errorText, { color: c.semantic.negative }]}>Height must be between 100-250 cm (3'3" - 8'2")</Text>
      )}

      {/* ── Weight — horizontal scroll scale ─────────────────────────── */}
      <View style={styles.fieldRow}>
        <Text style={[styles.label, { color: c.text.secondary }]}>Weight</Text>
        <TouchableOpacity onPress={toggleUnits} style={[styles.unitToggle, { backgroundColor: c.accent.primaryMuted }]} accessibilityLabel="Toggle units" accessibilityRole="button">
          <Text style={[styles.unitToggleText, { color: c.accent.primary }]}>
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
      {!weightValid && (
        <Text style={[styles.errorText, { color: c.semantic.negative }]}>Weight must be between 30-300 kg (66-660 lbs)</Text>
      )}

      {/* ── Live BMR display ─────────────────────────────────────────── */}
      {liveBMR > 0 && (
        <View style={[styles.bmrCard, { backgroundColor: c.bg.surfaceRaised, borderColor: c.accent.primaryMuted }]}>
          <Text style={[styles.bmrLabel, { color: c.text.secondary }]}>Your BMR</Text>
          <Text style={[styles.bmrValue, { color: c.accent.primary }]}>~{displayBMR.toLocaleString()} kcal/day</Text>
          <Text style={[styles.bmrHint, { color: c.text.muted }]}>Calories your body burns at rest</Text>
        </View>
      )}

      {onSkip && (
        <TouchableOpacity onPress={onSkip} style={styles.skipBtn}
          accessibilityLabel="Skip measurements" accessibilityRole="button">
          <Text style={[styles.skipText, { color: c.text.secondary }]}>Skip for now</Text>
        </TouchableOpacity>
      )}

      {onNext && (
        <Button title="Next" onPress={onNext} disabled={!canProceed} style={styles.nextBtn} />
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: spacing[4], paddingBottom: spacing[10] },
  title: { color: c.text.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, marginBottom: spacing[1], lineHeight: typography.lineHeight['2xl'] },
  subtitle: { color: c.text.secondary, fontSize: typography.size.base, marginBottom: spacing[6], lineHeight: typography.lineHeight.base },
  label: { color: c.text.secondary, fontSize: typography.size.sm, fontWeight: typography.weight.medium, marginBottom: spacing[2], marginTop: spacing[4], lineHeight: typography.lineHeight.sm },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing[4], marginBottom: spacing[2] },
  unitToggle: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full, backgroundColor: c.accent.primaryMuted },
  unitToggleText: { color: c.accent.primary, fontSize: typography.size.xs, fontWeight: typography.weight.semibold, lineHeight: typography.lineHeight.xs },
  errorText: { color: c.semantic.negative, fontSize: typography.size.sm, marginTop: spacing[2], textAlign: 'center', lineHeight: typography.lineHeight.sm },
  bmrCard: { backgroundColor: c.bg.surfaceRaised, borderRadius: radius.md, borderWidth: 1, borderColor: c.accent.primaryMuted, padding: spacing[4], marginTop: spacing[6], alignItems: 'center' },
  bmrLabel: { color: c.text.secondary, fontSize: typography.size.sm, fontWeight: typography.weight.medium, lineHeight: typography.lineHeight.sm },
  bmrValue: { color: c.accent.primary, fontSize: typography.size.xl, fontWeight: typography.weight.bold, marginTop: spacing[1], fontVariant: ['tabular-nums'], lineHeight: typography.lineHeight.xl },
  bmrHint: { color: c.text.muted, fontSize: typography.size.xs, marginTop: spacing[1], lineHeight: typography.lineHeight.xs },
  nextBtn: { marginTop: spacing[6], width: '100%' },
  skipBtn: { alignItems: 'center', marginTop: spacing[3] },
  skipText: { fontSize: typography.size.sm },
});
