import React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptic } from '../../utils/haptics';
import { springs } from '../../theme/tokens';
import { useReduceMotion } from '../../hooks/useReduceMotion';

interface AnimatedPressableProps extends PressableProps {
  hapticStyle?: 'light' | 'medium' | 'none';
}

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AnimatedPressable({
  hapticStyle = 'light',
  onPressIn,
  onPressOut,
  onPress,
  style,
  children,
  ...rest
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const reduceMotion = useReduceMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <ReanimatedPressable
      onPressIn={(e) => {
        if (!reduceMotion) scale.value = withSpring(0.96, springs.snappy);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduceMotion) scale.value = withSpring(1, springs.snappy);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (hapticStyle !== 'none') haptic[hapticStyle]();
        onPress?.(e);
      }}
      style={[animatedStyle, typeof style === 'function' ? undefined : style]}
      {...rest}
    >
      {children}
    </ReanimatedPressable>
  );
}
