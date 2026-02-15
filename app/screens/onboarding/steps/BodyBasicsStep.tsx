import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { colors, spacing, typography, radius } from '../../../theme/tokens';
import { useOnboardingStore } from '../../../store/onboardingSlice';
import type { Sex } from '../../../store/onboardingSlice';
import { Button } from '../../../components/common/Button';

interface Props {
  onNext?: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  onComplete?: () => void;
  onEditStep?: (step: number) => void;
}

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Vertical picker constants ───────────────────────────────────────────────
const PICKER_ITEM_HEIGHT = 44;
const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = CURRENT_YEAR - 100;
const MAX_YEAR = CURRENT_YEAR - 13;
const YEARS: number[] = [];
for (let y = MAX_YEAR; y >= MIN_YEAR; y--) YEARS.push(y);
const DEFAULT_YEAR = CURRENT_YEAR - 25;
const MONTHS: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// ─── Vertical Scroll Picker ──────────────────────────────────────────────────

interface VerticalPickerProps {
  data: { value: number; label: string }[];
  selectedValue: number;
  onValueChange: (val: number) => void;
}

function VerticalPicker({ data, selectedValue, onValueChange }: VerticalPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const VISIBLE_COUNT = 5;
  const ITEM_H = PICKER_ITEM_HEIGHT;
  const containerH = ITEM_H * VISIBLE_COUNT;

  // Scroll to selected item on mount
  useEffect(() => {
    const idx = data.findIndex((d) => d.value === selectedValue);
    if (idx >= 0 && scrollRef.current) {
      const offset = idx * ITEM_H;
      setTimeout(() => scrollRef.current?.scrollTo({ y: offset, animated: false }), 50);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTap = useCallback(
    (val: number, index: number) => {
      onValueChange(val);
      // Scroll so tapped item is near center
      const offset = Math.max(0, index * ITEM_H - ITEM_H * 2);
      scrollRef.current?.scrollTo({ y: offset, animated: true });
    },
    [onValueChange, ITEM_H],
  );

  return (
    <View style={[pickerStyles.wrapper, { height: containerH }]}>
      <View style={pickerStyles.fadeTop} pointerEvents="none" />
      <View style={pickerStyles.fadeBottom} pointerEvents="none" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        style={{ height: containerH }}
      >
        {data.map((item, i) => {
          const isSelected = item.value === selectedValue;
          return (
            <TouchableOpacity
              key={item.value}
              style={pickerStyles.item}
              onPress={() => handleTap(item.value, i)}
              activeOpacity={0.6}
            >
              <Text style={[pickerStyles.text, isSelected ? pickerStyles.textSelected : pickerStyles.textMuted]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: 'hidden',
    position: 'relative',
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: PICKER_ITEM_HEIGHT * 1.5,
    backgroundColor: colors.bg.surfaceRaised,
    opacity: 0.75,
    zIndex: 5,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: PICKER_ITEM_HEIGHT * 1.5,
    backgroundColor: colors.bg.surfaceRaised,
    opacity: 0.75,
    zIndex: 5,
  },
  item: {
    height: PICKER_ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontVariant: ['tabular-nums'],
  },
  textSelected: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.accent.primary,
  },
  textMuted: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    color: colors.text.muted,
    opacity: 0.4,
  },
});

// ─── Main Component ──────────────────────────────────────────────────────────

export function BodyBasicsStep({ onNext }: Props) {
  const {
    sex,
    birthYear,
    birthMonth,
    updateField,
  } = useOnboardingStore();

  // Track whether user explicitly chose a sex (store defaults to 'male')
  const [sexChosen, setSexChosen] = useState(false);

  const selectedYear = birthYear ?? DEFAULT_YEAR;
  const selectedMonth = birthMonth ?? (new Date().getMonth() + 1);

  // ─── Picker data ──────────────────────────────────────────────────────

  const yearData = useMemo(
    () => YEARS.map((y) => ({ value: y, label: String(y) })),
    [],
  );

  const monthData = useMemo(
    () => MONTHS.map((m) => ({ value: m, label: MONTH_LABELS[m - 1] })),
    [],
  );

  const handleYearChange = useCallback((val: number) => updateField('birthYear', val), [updateField]);
  const handleMonthChange = useCallback((val: number) => updateField('birthMonth', val), [updateField]);

  const handleSexSelect = useCallback(
    (value: Sex) => {
      updateField('sex', value);
      setSexChosen(true);
    },
    [updateField],
  );

  const canProceed = sexChosen && birthYear !== null && birthYear > 1900;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Body Basics</Text>
      <Text style={styles.subtitle}>We'll use this to calculate your metabolism</Text>

      {/* ── Sex selector ─────────────────────────────────────────────── */}
      <Text style={styles.label}>Sex</Text>
      <View style={styles.pillRow}>
        {SEX_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.pill, sex === opt.value && sexChosen && styles.pillActive]}
            onPress={() => handleSexSelect(opt.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, sex === opt.value && sexChosen && styles.pillTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Birth Year & Month — side by side scroll pickers ────────── */}
      <View style={styles.dateRow}>
        <View style={styles.dateCol}>
          <Text style={styles.label}>Birth Year</Text>
          <VerticalPicker data={yearData} selectedValue={selectedYear} onValueChange={handleYearChange} />
        </View>
        <View style={styles.dateCol}>
          <Text style={styles.label}>Month</Text>
          <VerticalPicker data={monthData} selectedValue={selectedMonth} onValueChange={handleMonthChange} />
        </View>
      </View>

      {onNext && (
        <Button title="Next" onPress={onNext} disabled={!canProceed} style={styles.nextBtn} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: spacing[4], paddingBottom: spacing[10] },
  title: { color: colors.text.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, marginBottom: spacing[1] },
  subtitle: { color: colors.text.secondary, fontSize: typography.size.base, marginBottom: spacing[6] },
  label: { color: colors.text.secondary, fontSize: typography.size.sm, fontWeight: typography.weight.medium, marginBottom: spacing[2], marginTop: spacing[4] },
  pillRow: { flexDirection: 'row', gap: spacing[2] },
  pill: { flex: 1, paddingVertical: spacing[3], borderRadius: radius.md, backgroundColor: colors.bg.surfaceRaised, borderWidth: 1, borderColor: colors.border.subtle, alignItems: 'center' },
  pillActive: { backgroundColor: colors.accent.primaryMuted, borderColor: colors.accent.primary },
  pillText: { color: colors.text.secondary, fontSize: typography.size.base, fontWeight: typography.weight.medium },
  pillTextActive: { color: colors.accent.primary, fontWeight: typography.weight.semibold },
  dateRow: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  dateCol: { flex: 1 },
  nextBtn: { marginTop: spacing[6], width: '100%' },
});
