import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptic } from '../../utils/haptics';
import { colors, radius, spacing, typography, springs } from '../../theme/tokens';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  colors?: string[];
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GradientButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  colors: gradientColors,
  style,
}: GradientButtonProps) {
  const scale = useSharedValue(1);
  const resolvedColors = gradientColors ?? [...colors.gradient.premiumCta];
  const isDisabled = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: isDisabled ? 0.5 : 1,
  }));

  const handlePressIn = () => { scale.value = withSpring(0.97, springs.snappy); };
  const handlePressOut = () => { scale.value = withSpring(1, springs.snappy); };
  const handlePress = () => {
    if (isDisabled) return;
    haptic.medium();
    onPress();
  };

  const content = loading
    ? <ActivityIndicator color={variant === 'primary' ? '#fff' : resolvedColors[0]} />
    : <Text style={[styles.text, variant === 'secondary' && { color: resolvedColors[0] }]}>{title}</Text>;

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={isDisabled}
      style={[animatedStyle, style]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={resolvedColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradient}>
          {content}
        </LinearGradient>
      ) : (
        <LinearGradient colors={resolvedColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradient}>
          <View style={styles.secondaryInner}>{content}</View>
        </LinearGradient>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryInner: {
    backgroundColor: colors.bg.base,
    borderRadius: radius.md - 1,
    margin: 1,
    paddingVertical: spacing[3] - 1,
    paddingHorizontal: spacing[6] - 1,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});
