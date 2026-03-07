import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { spacing, typography, radius } from '../../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../../hooks/useThemeColors';
import { useOnboardingStore, computeAge } from '../../../store/onboardingSlice';
import type { ActivityLevel, ExerciseType } from '../../../store/onboardingSlice';
import { computeBMR, computeNEAT, computeEAT } from '../../../utils/onboardingCalculations';
import { Button } from '../../../components/common/Button';
import { Icon, IconName } from '../../../components/common/Icon';
import { useHaptics } from '../../../hooks/useHaptics';

interface Props {
  onNext?: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  onComplete?: () => void;
  onEditStep?: (step: number) => void;
}

interface ActivityOption {
  value: ActivityLevel;
  icon: IconName;
  label: string;
  desc: string;
}

const ACTIVITY_OPTIONS: ActivityOption[] = [
  { value: 'sedentary', icon: 'chair', label: 'Desk job', desc: 'Mostly sitting all day' },
  { value: 'lightly_active', icon: 'walk', label: 'On my feet some', desc: 'Light walking, errands' },
  { value: 'moderately_active', icon: 'run', label: 'Physically active', desc: 'Active job or daily movement' },
  { value: 'highly_active', icon: 'lightning', label: 'Very physical', desc: 'Manual labor or constant movement' },
  { value: 'very_highly_active', icon: 'lightning', label: 'Extremely active', desc: 'Exercise 6-7x/week + physical job' },
];

const SESSION_COUNTS = [0, 1, 2, 3, 4, 5, 6, 7];

interface ExerciseChip {
  value: ExerciseType;
  label: string;
}

const EXERCISE_CHIPS: ExerciseChip[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'sports', label: 'Sports' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'walking', label: 'Walking' },
];

export function LifestyleStep({ onNext }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const {
    activityLevel,
    exerciseSessionsPerWeek,
    exerciseTypes,
    sex,
    birthYear,
    birthMonth,
    heightCm,
    weightKg,
    bodyFatPct,
    updateField,
  } = useOnboardingStore();
  const { impact } = useHaptics();

  // Live TDEE activity component
  const age = computeAge(birthYear, birthMonth);
  const { dailyActivity, perSession } = useMemo(() => {
    const bmr = computeBMR(weightKg, heightCm, age, sex, bodyFatPct ?? undefined);
    if (bmr <= 0) return { dailyActivity: 0, perSession: 0 };
    const neat = computeNEAT(bmr, activityLevel, weightKg);
    const eat = computeEAT(weightKg, exerciseSessionsPerWeek, exerciseTypes);
    // Per-session: daily EAT × 7 / sessions (reverse the averaging)
    const sessionCal = exerciseSessionsPerWeek > 0 ? Math.round((eat * 7) / exerciseSessionsPerWeek) : 0;
    return { dailyActivity: neat + eat, perSession: sessionCal };
  }, [weightKg, heightCm, age, sex, bodyFatPct, activityLevel, exerciseSessionsPerWeek, exerciseTypes]);

  const toggleExerciseType = (type: ExerciseType) => {
    impact('light');
    const current = [...exerciseTypes];
    const idx = current.indexOf(type);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(type);
    }
    updateField('exerciseTypes', current);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: c.text.primary }]}>Lifestyle</Text>
      <Text style={[styles.subtitle, { color: c.text.secondary }]}>Help us understand your daily activity</Text>

      {/* Activity level */}
      <Text style={[styles.sectionLabel, { color: c.text.primary }]}>What does a typical day look like?</Text>
      <View style={styles.activityGrid}>
        {ACTIVITY_OPTIONS.map((opt) => {
          const isSelected = activityLevel === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.activityCard, isSelected && styles.activityCardSelected]}
              onPress={() => { impact('light'); updateField('activityLevel', opt.value); }}
              activeOpacity={0.7}
            >
              <Icon name={opt.icon} size={24} />
              <Text style={[styles.activityLabel, isSelected && styles.activityLabelSelected]}>
                {opt.label}
              </Text>
              <Text style={[styles.activityDesc, isSelected && styles.activityDescSelected]}>
                {opt.desc}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Exercise sessions per week */}
      <Text style={[styles.sectionLabel, { color: c.text.primary }]}>How many times per week do you exercise?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sessionRow}>
        {SESSION_COUNTS.map((n) => {
          const isSelected = exerciseSessionsPerWeek === n;
          const label = n === 7 ? '7+' : String(n);
          return (
            <TouchableOpacity
              key={n}
              style={[styles.sessionBtn, isSelected && styles.sessionBtnSelected]}
              onPress={() => { impact('light'); updateField('exerciseSessionsPerWeek', n); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.sessionText, isSelected && styles.sessionTextSelected]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Exercise types */}
      <Text style={[styles.sectionLabel, { color: c.text.primary }]}>What kind?</Text>
      <View style={styles.chipRow}>
        {EXERCISE_CHIPS.map((chip) => {
          const isSelected = exerciseTypes.includes(chip.value);
          return (
            <TouchableOpacity
              key={chip.value}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => toggleExerciseType(chip.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Live activity calorie display */}
      {dailyActivity > 0 && (
        <View style={[styles.activityCalCard, { backgroundColor: c.bg.surfaceRaised, borderColor: c.accent.primaryMuted }]}>
          {perSession > 0 && (
            <Text style={[styles.activityCalValue, { color: c.accent.primary }]}>~{perSession.toLocaleString()} cal per session</Text>
          )}
          <Text style={[styles.activityCalLabel, { color: c.text.secondary }]}>~{dailyActivity.toLocaleString()} cal/day average</Text>
          <Text style={[styles.activityCalHint, { color: c.text.muted }]}>From daily movement + exercise</Text>
        </View>
      )}

      {/* Next button */}
      {onNext && (
        <Button title="Next" onPress={onNext} style={styles.nextBtn} />
      )}
    </ScrollView>
  );
}


const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[10],
  },
  title: {
    color: c.text.primary,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    marginBottom: spacing[1],
    lineHeight: typography.lineHeight['2xl'],
  },
  subtitle: {
    color: c.text.secondary,
    fontSize: typography.size.base,
    marginBottom: spacing[6],
    lineHeight: typography.lineHeight.base,
  },
  sectionLabel: {
    color: c.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[3],
    marginTop: spacing[5],
    lineHeight: typography.lineHeight.base,
  },
  activityGrid: {
    gap: spacing[3],
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.subtle,
    padding: spacing[4],
    gap: spacing[3],
  },
  activityCardSelected: {
    borderColor: c.accent.primary,
    backgroundColor: c.accent.primaryMuted,
  },
  activityLabel: {
    color: c.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    flex: 1,
    lineHeight: typography.lineHeight.base,
  },
  activityLabelSelected: {
    color: c.accent.primary,
  },
  activityDesc: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    flex: 1,
    textAlign: 'right',
    lineHeight: typography.lineHeight.xs,
  },
  activityDescSelected: {
    color: c.text.secondary,
  },
  sessionRow: {
    flexDirection: 'row',
    marginBottom: spacing[2],
  },
  sessionBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: c.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: c.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[2],
  },
  sessionBtnSelected: {
    borderColor: c.accent.primary,
    backgroundColor: c.accent.primaryMuted,
  },
  sessionText: {
    color: c.text.secondary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    fontVariant: ['tabular-nums'],
    lineHeight: typography.lineHeight.base,
  },
  sessionTextSelected: {
    color: c.accent.primary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  chip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: c.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: c.border.subtle,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: c.accent.primary,
    backgroundColor: c.accent.primaryMuted,
  },
  chipText: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  chipTextSelected: {
    color: c.accent.primary,
    fontWeight: typography.weight.semibold,
  },
  activityCalCard: {
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.accent.primaryMuted,
    padding: spacing[4],
    marginTop: spacing[6],
    alignItems: 'center',
  },
  activityCalLabel: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  activityCalValue: {
    color: c.accent.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    marginTop: spacing[1],
    fontVariant: ['tabular-nums'],
    lineHeight: typography.lineHeight.xl,
  },
  activityCalHint: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    marginTop: spacing[1],
    lineHeight: typography.lineHeight.xs,
  },
  nextBtn: {
    marginTop: spacing[6],
    width: '100%',
  },
});
