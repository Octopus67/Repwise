import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { spacing, typography, radius, springs } from '../../../theme/tokens';
import { useHaptics } from '../../../hooks/useHaptics';
import { useThemeColors, ThemeColors } from '../../../hooks/useThemeColors';
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
  { min: 3, max: 14, midpoint: 12, label: '10–14%', maleDesc: 'Very lean, visible abs', femaleDesc: 'Very lean, athletic' },
  { min: 15, max: 19, midpoint: 17, label: '15–19%', maleDesc: 'Lean, some definition', femaleDesc: 'Lean, toned look' },
  { min: 20, max: 24, midpoint: 22, label: '20–24%', maleDesc: 'Average, soft midsection', femaleDesc: 'Fit, healthy range' },
  { min: 25, max: 29, midpoint: 27, label: '25–29%', maleDesc: 'Above average body fat', femaleDesc: 'Average, some softness' },
  { min: 30, max: 34, midpoint: 32, label: '30–34%', maleDesc: 'High body fat', femaleDesc: 'Above average body fat' },
  { min: 35, max: 60, midpoint: 38, label: '35%+', maleDesc: 'Very high body fat', femaleDesc: 'High body fat' },
];

function AnimatedCard({ isSelected, children, onPress, accessibilityLabel }: {
  isSelected: boolean; children: React.ReactNode; onPress: () => void; accessibilityLabel: string;
}) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSpring(1.05, springs.snappy);
    setTimeout(() => { scale.value = withSpring(1, springs.gentle); }, 100);
    onPress();
  };

  return (
    <Animated.View style={[styles.card, isSelected && styles.cardSelected, animStyle]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7}
        accessibilityLabel={accessibilityLabel} accessibilityRole="button">
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

export function BodyCompositionStep({ onNext }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const { impact } = useHaptics();
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
    if (weightKg > 0 && heightCm > 0 && sex) {
      return estimateBodyFat(weightKg, heightCm, sex);
    }
    return null;
  }, [weightKg, heightCm, sex]);

  // Validation
  const bodyFatValid = bodyFatPct === null || (bodyFatPct >= 3 && bodyFatPct <= 60);

  const handleSelectRange = (midpoint: number) => {
    impact('light');
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
  const canProceed = (bodyFatPct !== null && bodyFatValid) || bodyFatSkipped;

  const getGradientColors = (midpoint: number): [string, string] => {
    if (midpoint <= 17) return ['#10B981', '#22C55E'];
    if (midpoint <= 27) return ['#F59E0B', '#F97316'];
    return ['#EF4444', '#F97316'];
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: c.text.primary }]}>Body Composition</Text>
      <Text style={[styles.subtitle, { color: c.text.secondary }]}>
        Select the range that best describes your current physique
      </Text>

      {/* Educational info card */}
      <View style={[styles.infoCard, { backgroundColor: c.bg.surfaceRaised }]}>
        <Text style={[styles.infoText, { color: c.text.secondary }]}>
          Body fat percentage is the proportion of your total weight that comes from fat tissue. Knowing your approximate body fat helps us calculate your lean mass for more accurate calorie targets.
        </Text>
        <Text style={[styles.infoHint, { color: c.text.muted }]}>
          Don't worry about being exact — an estimate within 5% is perfectly fine.
        </Text>
      </View>

      {/* Body fat range cards */}
      <View style={styles.grid}>
        {BODY_FAT_RANGES.map((range) => {
          const isSelected = bodyFatPct === range.midpoint && !bodyFatSkipped;
          const fillColors = getGradientColors(range.midpoint);
          return (
            <AnimatedCard
              key={range.label}
              isSelected={isSelected}
              onPress={() => handleSelectRange(range.midpoint)}
              accessibilityLabel={`Select body fat range ${range.label}: ${isMale ? range.maleDesc : range.femaleDesc}`}
            >
              <View style={styles.cardRow}>
                {/* Gradient fill bar */}
                <View style={[styles.barTrack, { backgroundColor: c.border.subtle }]}>
                  <LinearGradient
                    colors={fillColors}
                    style={[styles.barFill, { height: `${Math.min((range.midpoint / 60) * 100, 100)}%` }]}
                  />
                </View>
                {/* Card content */}
                <View style={styles.cardContent}>
                  <Text style={[styles.cardPct, isSelected && styles.cardPctSelected]}>
                    {range.label}
                  </Text>
                  <Text style={[styles.cardDesc, isSelected && styles.cardDescSelected]}>
                    {isMale ? range.maleDesc : range.femaleDesc}
                  </Text>
                </View>
              </View>
            </AnimatedCard>
          );
        })}
      </View>

      {/* Validation error */}
      {bodyFatPct !== null && !bodyFatValid && (
        <Text style={[styles.errorText, { color: c.semantic.negative }]}>Body fat must be between 3-60%</Text>
      )}

      {/* Skip / auto-estimate */}
      <TouchableOpacity style={[styles.skipBtn, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.subtle }]} onPress={handleSkip} activeOpacity={0.7} accessibilityLabel="Skip body fat selection" accessibilityRole="button">
        <Text style={[styles.skipText, { color: c.text.secondary }]}>Not sure? We'll estimate for you</Text>
      </TouchableOpacity>

      {/* Show auto-estimate if skipped */}
      {bodyFatSkipped && autoEstimate && (
        <View style={[styles.estimateCard, { backgroundColor: c.bg.surfaceRaised, borderColor: c.accent.primaryMuted }]}>
          <Text style={[styles.estimateLabel, { color: c.text.secondary }]}>Based on your profile, we estimate</Text>
          <Text style={[styles.estimateValue, { color: c.accent.primary }]}>~{autoEstimate.estimate}%</Text>
          <Text style={[styles.estimateRange, { color: c.text.muted }]}>
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
  },
  subtitle: {
    color: c.text.secondary,
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
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.subtle,
    padding: 0,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: c.accent.primary,
    backgroundColor: c.accent.primaryMuted,
  },
  cardPct: {
    color: c.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    marginBottom: spacing[1],
    fontVariant: ['tabular-nums'],
  },
  cardPctSelected: {
    color: c.accent.primary,
  },
  cardDesc: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    textAlign: 'center',
    lineHeight: typography.size.xs * typography.lineHeight.normal,
  },
  cardDescSelected: {
    color: c.text.secondary,
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
    backgroundColor: c.border.subtle,
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
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  infoText: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
  },
  infoHint: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    marginTop: spacing[2],
    lineHeight: typography.size.xs * typography.lineHeight.normal,
  },
  errorText: {
    color: c.semantic.negative,
    fontSize: typography.size.sm,
    marginTop: spacing[2],
    textAlign: 'center',
    lineHeight: typography.lineHeight.sm,
  },
  skipBtn: {
    alignSelf: 'center',
    marginTop: spacing[5],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius: radius.full,
    backgroundColor: c.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  skipText: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  estimateCard: {
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.accent.primaryMuted,
    padding: spacing[4],
    marginTop: spacing[4],
    alignItems: 'center',
  },
  estimateLabel: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
  },
  estimateValue: {
    color: c.accent.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    marginTop: spacing[1],
    fontVariant: ['tabular-nums'],
  },
  estimateRange: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    marginTop: spacing[1],
    fontVariant: ['tabular-nums'],
  },
  nextBtn: {
    marginTop: spacing[6],
    width: '100%',
  },
});
