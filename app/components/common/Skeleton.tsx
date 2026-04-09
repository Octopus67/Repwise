import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform, type DimensionValue, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { motion } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';

interface SkeletonProps {
  width: DimensionValue;
  height: number;
  borderRadius?: number;
  variant?: 'rect' | 'circle';
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export function Skeleton({
  width,
  height,
  borderRadius = 8,
  variant = 'rect',
}: SkeletonProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const resolvedRadius = variant === 'circle' ? height / 2 : borderRadius;
  const isWeb = Platform.OS === 'web';
  const reduceMotion = useReduceMotion();

  const [containerWidth, setContainerWidth] = useState(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(isWeb ? 0.5 : 0.3);

  const onLayout = (e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 0.5;
      return;
    }
    if (isWeb) {
      opacity.value = withRepeat(withTiming(0.7, { duration: motion.duration.pulse }), -1, true);
      return;
    }
    if (containerWidth > 0) {
      translateX.value = -containerWidth;
      translateX.value = withRepeat(
        withTiming(containerWidth, { duration: 1200, easing: Easing.linear }),
        -1,
        false,
      );
    }
  }, [containerWidth, isWeb, reduceMotion]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const webStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (isWeb) {
    return (
      <Animated.View
        style={[styles.base, { width, height, borderRadius: resolvedRadius, backgroundColor: c.bg.surfaceRaised }, webStyle]}
      />
    );
  }

  return (
    <View
      onLayout={onLayout}
      style={[styles.base, { width, height, borderRadius: resolvedRadius, overflow: 'hidden', backgroundColor: c.bg.surfaceRaised }]}
    >
      {containerWidth > 0 && (
        <AnimatedLinearGradient
          colors={['transparent', 'rgba(255,255,255,0.08)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[StyleSheet.absoluteFill, { width: containerWidth }, shimmerStyle]}
        />
      )}
    </View>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  base: {
    backgroundColor: c.bg.surfaceRaised,
  },
});
