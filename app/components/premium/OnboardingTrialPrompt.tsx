import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../common/Icon';
import { Button } from '../common/Button';

interface OnboardingTrialPromptProps {
  onStartTrial: () => void;
  onSkip: () => void;
  loading?: boolean;
  /** User's goal label, e.g. "lose fat" or "build muscle" */
  goalLabel?: string;
}

const FREE_VS_PREMIUM: { feature: string; free: boolean; premium: boolean }[] = [
  { feature: 'Basic calorie tracking', free: true, premium: true },
  { feature: 'Adaptive nutrition engine', free: false, premium: true },
  { feature: '1:1 Coaching sessions', free: false, premium: true },
  { feature: 'Detailed analytics & insights', free: false, premium: true },
  { feature: 'Health report analysis', free: false, premium: true },
];

export function OnboardingTrialPrompt({
  onStartTrial,
  onSkip,
  loading,
  goalLabel,
}: OnboardingTrialPromptProps) {
  const c = useThemeColors();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const animStyle = {
    opacity: anim,
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
  };

  const personalCopy = goalLabel
    ? `Your ${goalLabel} plan is ready. Unlock the full experience.`
    : 'Your plan is ready. Unlock the full experience.';

  return (
    <Animated.View style={[styles.wrapper, { backgroundColor: c.gradient?.start ?? '#06B6D4' }, animStyle]}>
      <View style={styles.container}>
        {/* Large icon with subtle glow */}
        <View style={[styles.iconCircle, { backgroundColor: c.premium.goldSubtle }]}>
          <Icon name="star" size={48} color={c.premium.gold} />
        </View>

        <Text style={styles.title}>Try Premium Free for 14 Days</Text>
        <Text style={styles.subtitle}>{personalCopy}</Text>
        <Text style={styles.noCc}>No credit card required.</Text>

        {/* Social proof */}
        <View style={styles.socialProof}>
          <Text style={styles.socialProofText}>
            ⭐ 4.8 rating · Join 10,000+ users already training smarter
          </Text>
        </View>

        {/* Free vs Premium comparison */}
        <View style={[styles.comparisonCard, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
          <View style={styles.comparisonHeader}>
            <Text style={[styles.comparisonHeaderText, { flex: 1 }]}>Feature</Text>
            <Text style={styles.comparisonHeaderText}>Free</Text>
            <Text style={styles.comparisonHeaderText}>Premium</Text>
          </View>
          {FREE_VS_PREMIUM.map((row) => (
            <View key={row.feature} style={styles.comparisonRow}>
              <Text style={[styles.comparisonFeature, { flex: 1 }]}>{row.feature}</Text>
              <View style={styles.comparisonCell}>
                {row.free ? (
                  <Icon name="check" size={14} color="#22C55E" />
                ) : (
                  <Icon name="close" size={14} color="rgba(255,255,255,0.35)" />
                )}
              </View>
              <View style={styles.comparisonCell}>
                <Icon name="check" size={14} color="#22C55E" />
              </View>
            </View>
          ))}
        </View>

        <Button
          title="Start Free Trial"
          onPress={onStartTrial}
          loading={loading}
          style={styles.cta}
        />
        <Button title="Skip for now" onPress={onSkip} variant="ghost" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  title: {
    fontSize: typography.size.xl,
    lineHeight: typography.lineHeight.xl,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing[2],
  },
  noCc: {
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    color: 'rgba(255,255,255,0.6)',
    marginTop: spacing[1],
    marginBottom: spacing[3],
  },
  socialProof: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    marginBottom: spacing[6],
  },
  socialProofText: {
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: typography.weight.medium,
    textAlign: 'center',
  },
  comparisonCard: {
    alignSelf: 'stretch',
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[6],
  },
  comparisonHeader: {
    flexDirection: 'row',
    marginBottom: spacing[2],
    paddingBottom: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  comparisonHeaderText: {
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    fontWeight: typography.weight.semibold,
    color: 'rgba(255,255,255,0.7)',
    width: 60,
    textAlign: 'center',
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  comparisonFeature: {
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    color: '#FFFFFF',
  },
  comparisonCell: {
    width: 60,
    alignItems: 'center',
  },
  cta: {
    alignSelf: 'stretch',
    marginBottom: spacing[3],
  },
});
