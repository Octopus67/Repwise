import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, typography, radius } from '../../../theme/tokens';
import { useOnboardingStore } from '../../../store/onboardingSlice';
import { estimateBodyFat } from '../../../utils/onboardingCalculations';
import { Button } from '../../../components/common/Button';

interface Props {
  onNext?: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  onComplete?: () => void;
  onEditStep?: (step: number) => void;
}

interface BodyFatRange {
  min: number;
  max: number;
  midpoint: number;
  label: string;
  maleDesc: string;
  femaleDesc: string;
}

const BODY_FAT_RANGES: BodyFatRange[] = [
  { min: 10, max: 14, midpoint: 12, label: '10–14%', maleDesc: 'Very lean, visible abs', femaleDesc: 'Very lean, athletic' },
  { min: 15, max: 19, midpoint: 17, label: '15–19%', maleDesc: 'Lean, some definition', femaleDesc: 'Lean, toned look' },
  { min: 20, max: 24, midpoint: 22, label: '20–24%', maleDesc: 'Average, soft midsection', femaleDesc: 'Fit, healthy range' },
  { min: 25, max: 29, midpoint: 27, label: '25–29%', maleDesc: 'Above average body fat', femaleDesc: 'Average, some softness' },
  { min: 30, max: 34, midpoint: 32, label: '30–34%', maleDesc: 'High body fat', femaleDesc: 'Above average body fat' },
  { min: 35, max: 50, midpoint: 38, label: '35%+', maleDesc: 'Very high body fat', femaleDesc: 'High body fat' },
];

export function BodyCompositionStep({ onNext }: Props) {
  const {
    sex,
    bodyFatPct,
    bodyFatSkipped,
    weightKg,
    heightCm,
    updateField,
  } = useOnboardingStore();

  // Auto-estimate for skip scenario
  const autoEstimate = useMemo(() => {
    if (weightKg > 0 && heightCm > 0) {
      return estimateBodyFat(weightKg, heightCm, sex);
    }
    return null;
  }, [weightKg, heightCm, sex]);

  const handleSelectRange = (midpoint: number) => {
    updateField('bodyFatPct', midpoint);
    updateField('bodyFatSkipped', false);
  };

  const handleSkip = () => {
    if (autoEstimate) {
      updateField('bodyFatPct', autoEstimate.estimate);
    }
    updateField('bodyFatSkipped', true);
    onNext?.();
  };

  const isMale = sex === 'male';
  const canProceed = bodyFatPct !== null;

  const getFillColor = (midpoint: number) => {
    if (midpoint <= 17) return colors.semantic.positive;
    if (midpoint <= 27) return colors.semantic.warning;
    return colors.semantic.negative;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Body Composition</Text>
      <Text style={styles.subtitle}>
        Select the range that best describes your current physique
      </Text>

      {/* Educational info card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          Body fat percentage is the proportion of your total weight that comes from fat tissue. Knowing your approximate body fat helps us calculate your lean mass for more accurate calorie targets.
        </Text>
        <Text style={styles.infoHint}>
          Don't worry about being exact — an estimate within 5% is perfectly fine.
        </Text>
      </View>

      {/* Body fat range cards */}
      <View style={styles.grid}>
        {BODY_FAT_RANGES.map((range) => {
          const isSelected = bodyFatPct === range.midpoint && !bodyFatSkipped;
          return (
            <TouchableOpacity
              key={range.label}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => handleSelectRange(range.midpoint)}
              activeOpacity={0.7}
            >
              <View style={styles.cardRow}>
                {/* Vertical fill bar */}
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${Math.min((range.midpoint / 50) * 100, 100)}%`,
                        backgroundColor: getFillColor(range.midpoint),
                      },
                    ]}
                  />
                </View>
                {/* Card content */}
                <View style={styles.cardContent}>
                  <Text style={[styles.cardPct, isSelected && styles.cardPctSelected]}>
                    {range.label}
                  </Text>
                  <Text style={[styles.cardDesc, isSelected && styles.cardDescSelected]}>
                    {isMale || sex === 'other' ? range.maleDesc : range.femaleDesc}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Skip / auto-estimate */}
      <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
        <Text style={styles.skipText}>Not sure? We'll estimate for you</Text>
      </TouchableOpacity>

      {/* Show auto-estimate if skipped */}
      {bodyFatSkipped && autoEstimate && (
        <View style={styles.estimateCard}>
          <Text style={styles.estimateLabel}>Based on your profile, we estimate</Text>
          <Text style={styles.estimateValue}>~{autoEstimate.estimate}%</Text>
          <Text style={styles.estimateRange}>
            Range: {autoEstimate.low}% – {autoEstimate.high}%
          </Text>
        </View>
      )}

      {/* Next button */}
      {onNext && (
        <Button
          title="Next"
          onPress={onNext}
          disabled={!canProceed}
          style={styles.nextBtn}
        />
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
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    marginBottom: spacing[6],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  card: {
    width: '47%',
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: 0,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.primaryMuted,
  },
  cardPct: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    marginBottom: spacing[1],
    fontVariant: ['tabular-nums'],
  },
  cardPctSelected: {
    color: colors.accent.primary,
  },
  cardDesc: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    textAlign: 'center',
    lineHeight: typography.size.xs * typography.lineHeight.normal,
  },
  cardDescSelected: {
    color: colors.text.secondary,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 64,
  },
  barTrack: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: colors.border.subtle,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 2,
  },
  cardContent: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[4],
    justifyContent: 'center',
  },
  infoCard: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  infoText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
  },
  infoHint: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    marginTop: spacing[2],
    lineHeight: typography.size.xs * typography.lineHeight.normal,
  },
  skipBtn: {
    alignSelf: 'center',
    marginTop: spacing[5],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius: radius.full,
    backgroundColor: colors.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  skipText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  estimateCard: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent.primaryMuted,
    padding: spacing[4],
    marginTop: spacing[4],
    alignItems: 'center',
  },
  estimateLabel: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
  },
  estimateValue: {
    color: colors.accent.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    marginTop: spacing[1],
    fontVariant: ['tabular-nums'],
  },
  estimateRange: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    marginTop: spacing[1],
    fontVariant: ['tabular-nums'],
  },
  nextBtn: {
    marginTop: spacing[6],
    width: '100%',
  },
});
