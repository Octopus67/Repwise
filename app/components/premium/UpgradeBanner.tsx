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
import { Icon } from '../common/Icon';
import { useReduceMotion } from '../../hooks/useReduceMotion';

interface UpgradeBannerProps {
  onPress: () => void;
}

export function UpgradeBanner({ onPress }: UpgradeBannerProps) {
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
    <TouchableOpacity style={styles.banner} onPress={onPress} activeOpacity={0.8}>
      <Animated.View style={[styles.content, pulseStyle]}>
        <Icon name="star" size={16} color={colors.premium.gold} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>Unlock Premium</Text>
          <Text style={styles.subtitle}>
            Coaching, advanced analytics, health reports & more
          </Text>
        </View>
        <Text style={styles.arrow}>→</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.accent.primaryMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent.primary,
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
    color: colors.text.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    fontWeight: typography.weight.semibold,
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginTop: 2,
  },
  arrow: {
    color: colors.accent.primary,
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    fontWeight: typography.weight.semibold,
  },
});
