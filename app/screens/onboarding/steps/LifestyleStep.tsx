import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, typography, radius } from '../../../theme/tokens';
import { useOnboardingStore, computeAge } from '../../../store/onboardingSlice';
import type { ActivityLevel, ExerciseType } from '../../../store/onboardingSlice';
import { computeBMR, computeNEAT, computeEAT } from '../../../utils/onboardingCalculations';
import { Button } from '../../../components/common/Button';
import { Icon, IconName } from '../../../components/common/Icon';

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
  const {
    activityLevel,
    exerciseSessionsPerWeek,
    exerciseTypes,
    sex,
    birthYear,
    heightCm,
    weightKg,
    bodyFatPct,
    updateField,
  } = useOnboardingStore();

  // Live TDEE activity component
  const age = computeAge(birthYear, null);
  const liveActivity = useMemo(() => {
    const bmr = computeBMR(weightKg, heightCm, age, sex, bodyFatPct ?? undefined);
    if (bmr <= 0) return 0;
    const neat = computeNEAT(bmr, activityLevel, weightKg);
    const eat = computeEAT(weightKg, exerciseSessionsPerWeek, exerciseTypes);
    return neat + eat;
  }, [weightKg, heightCm, age, sex, bodyFatPct, activityLevel, exerciseSessionsPerWeek, exerciseTypes]);

  const toggleExerciseType = (type: ExerciseType) => {
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
      <Text style={styles.title}>Lifestyle</Text>
      <Text style={styles.subtitle}>Help us understand your daily activity</Text>

      {/* Activity level */}
      <Text style={styles.sectionLabel}>What does a typical day look like?</Text>
      <View style={styles.activityGrid}>
        {ACTIVITY_OPTIONS.map((opt) => {
          const isSelected = activityLevel === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.activityCard, isSelected && styles.activityCardSelected]}
              onPress={() => updateField('activityLevel', opt.value)}
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
      <Text style={styles.sectionLabel}>How many times per week do you exercise?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sessionRow}>
        {SESSION_COUNTS.map((n) => {
          const isSelected = exerciseSessionsPerWeek === n;
          const label = n === 7 ? '7+' : String(n);
          return (
            <TouchableOpacity
              key={n}
              style={[styles.sessionBtn, isSelected && styles.sessionBtnSelected]}
              onPress={() => updateField('exerciseSessionsPerWeek', n)}
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
      <Text style={styles.sectionLabel}>What kind?</Text>
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
      {liveActivity > 0 && (
        <View style={styles.activityCalCard}>
          <Text style={styles.activityCalLabel}>Daily activity burn</Text>
          <Text style={styles.activityCalValue}>~{liveActivity.toLocaleString()} kcal</Text>
          <Text style={styles.activityCalHint}>From daily movement + exercise</Text>
        </View>
      )}

      {/* Next button */}
      {onNext && (
        <Button title="Next" onPress={onNext} style={styles.nextBtn} />
      )}
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[10],
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    marginBottom: spacing[1],
    lineHeight: typography.lineHeight['2xl'],
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    marginBottom: spacing[6],
    lineHeight: typography.lineHeight.base,
  },
  sectionLabel: {
    color: colors.text.primary,
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
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing[4],
    gap: spacing[3],
  },
  activityCardSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.primaryMuted,
  },
  activityLabel: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    flex: 1,
    lineHeight: typography.lineHeight.base,
  },
  activityLabelSelected: {
    color: colors.accent.primary,
  },
  activityDesc: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    flex: 1,
    textAlign: 'right',
    lineHeight: typography.lineHeight.xs,
  },
  activityDescSelected: {
    color: colors.text.secondary,
  },
  sessionRow: {
    flexDirection: 'row',
    marginBottom: spacing[2],
  },
  sessionBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[2],
  },
  sessionBtnSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.primaryMuted,
  },
  sessionText: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    fontVariant: ['tabular-nums'],
    lineHeight: typography.lineHeight.base,
  },
  sessionTextSelected: {
    color: colors.accent.primary,
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
    backgroundColor: colors.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.primaryMuted,
  },
  chipText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  chipTextSelected: {
    color: colors.accent.primary,
    fontWeight: typography.weight.semibold,
  },
  activityCalCard: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent.primaryMuted,
    padding: spacing[4],
    marginTop: spacing[6],
    alignItems: 'center',
  },
  activityCalLabel: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  activityCalValue: {
    color: colors.accent.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    marginTop: spacing[1],
    fontVariant: ['tabular-nums'],
    lineHeight: typography.lineHeight.xl,
  },
  activityCalHint: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    marginTop: spacing[1],
    lineHeight: typography.lineHeight.xs,
  },
  nextBtn: {
    marginTop: spacing[6],
    width: '100%',
  },
});
