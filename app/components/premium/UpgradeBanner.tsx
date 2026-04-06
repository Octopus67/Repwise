import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../common/Icon';
import { GradientButton } from '../common/GradientButton';
import { useReduceMotion } from '../../hooks/useReduceMotion';

interface UpgradeBannerProps {
  onPress: () => void;
}

export function UpgradeBanner({ onPress }: UpgradeBannerProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const reduceMotion = useReduceMotion();
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 1500 }),
        withTiming(1, { duration: 1500 }),
      ),
      -1,
      false,
    );
  }, [reduceMotion]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  return (
    <TouchableOpacity style={[styles.banner, { backgroundColor: c.accent.primaryMuted, borderColor: c.accent.primary }]} onPress={onPress} activeOpacity={0.8}>
      <Animated.View style={[styles.content, pulseStyle]}>
        <Icon name="star" size={16} color={c.premium.gold} />
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: c.text.primary }]}>Unlock Premium</Text>
          <Text style={[styles.subtitle, { color: c.text.secondary }]}>
            Coaching, advanced analytics & more
          </Text>
        </View>
        <GradientButton title="Upgrade" onPress={onPress} colors={[...colors.gradientArrays.premium]} style={{ paddingHorizontal: 0 }} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  banner: {
    backgroundColor: c.accent.primaryMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.accent.primary,
    padding: spacing[4],
    marginHorizontal: spacing[4],
    marginVertical: spacing[2],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  icon: {},
  textContainer: {
    flex: 1,
  },
  title: {
    color: c.text.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    fontWeight: typography.weight.semibold,
  },
  subtitle: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginTop: 2,
  },
  arrow: {
    color: c.accent.primary,
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    fontWeight: typography.weight.semibold,
  },
});
