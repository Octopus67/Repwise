import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, type DimensionValue } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { motion } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

interface SkeletonProps {
  width: DimensionValue;
  height: number;
  borderRadius?: number;
  variant?: 'rect' | 'circle';
}

export function Skeleton({
  width,
  height,
  borderRadius = 8,
  variant = 'rect',
}: SkeletonProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const resolvedRadius = variant === 'circle' ? height / 2 : borderRadius;

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.base,
          { width, height, borderRadius: resolvedRadius, opacity: 0.5, backgroundColor: c.bg.surfaceRaised },
        ]}
      />
    );
  }

  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.7, { duration: motion.duration.pulse }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.base,
        { width, height, borderRadius: resolvedRadius, backgroundColor: c.bg.surfaceRaised },
        animatedStyle,
      ]}
    />
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  base: {
    backgroundColor: c.bg.surfaceRaised,
  },
});
