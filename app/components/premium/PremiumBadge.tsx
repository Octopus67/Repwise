import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../common/Icon';
import { useReduceMotion } from '../../hooks/useReduceMotion';

interface PremiumBadgeProps {
  size?: 'sm' | 'md';
}

const SHIMMER_WIDTH = 40;

export function PremiumBadge({ size = 'sm' }: PremiumBadgeProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const reduceMotion = useReduceMotion();
  const translateX = useSharedValue(-SHIMMER_WIDTH);

  useEffect(() => {
    if (reduceMotion) return;
    translateX.value = withRepeat(
      withDelay(3000, withTiming(80, { duration: 600, easing: Easing.inOut(Easing.ease) })),
      -1,
      false,
    );
  }, [reduceMotion]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={[styles.badge, size === 'md' && styles.badgeMd, { overflow: 'hidden' }]}>
      <Icon name="star" size={14} color={c.premium.gold} />
      <Text style={[styles.label, size === 'md' && styles.labelMd]}>PRO</Text>
      {!reduceMotion && (
        <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle, { width: SHIMMER_WIDTH }]}>
          <LinearGradient
            colors={['transparent', ...colors.gradientArrays.premium, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.premium.goldSubtle,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    gap: 2,
  },
  badgeMd: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    gap: 4,
  },
  icon: {},
  iconMd: {},
  label: {
    color: c.premium.gold,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    fontWeight: typography.weight.semibold,
  },
  labelMd: {
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
});
