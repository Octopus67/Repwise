import { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, typography, radius, springs } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useHaptics } from '../../hooks/useHaptics';

type Variant = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  variant: Variant;
  visible: boolean;
  onDismiss: () => void;
}

export function Toast({ message, variant, visible, onDismiss }: ToastProps) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { notification } = useHaptics();
  const translateY = useSharedValue(-100);

  const bgColor = variant === 'success' ? c.semantic.positive
    : variant === 'error' ? c.semantic.negative
    : c.accent.primary;

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, springs.snappy);
      if (variant === 'success') notification('success');
      else if (variant === 'error') notification('error');
      const timer = setTimeout(() => {
        translateY.value = withTiming(-100, { duration: 200 }, (finished) => {
          if (finished) runOnJS(onDismiss)();
        });
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      translateY.value = -100;
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { top: insets.top + spacing[2], backgroundColor: bgColor }, animStyle]}>
      <Text style={styles.text} numberOfLines={2}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    zIndex: 9999,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
  },
});
