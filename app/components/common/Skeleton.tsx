import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, motion } from '../../theme/tokens';

interface SkeletonProps {
  width: number | string;
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
  const resolvedRadius = variant === 'circle' ? height / 2 : borderRadius;

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.base,
          { width, height, borderRadius: resolvedRadius, opacity: 0.5 },
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
        { width, height, borderRadius: resolvedRadius },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.bg.surfaceRaised,
  },
});
