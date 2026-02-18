import { useEffect } from 'react';
import { View, Text, TouchableWithoutFeedback, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTooltipStore } from '../../store/tooltipStore';
import { colors, radius, spacing, typography, shadows, motion } from '../../theme/tokens';
import { useReduceMotion } from '../../hooks/useReduceMotion';

interface TooltipProps {
  tooltipId: string;
  text: string;
  children: React.ReactNode;
}

export const Tooltip = ({ tooltipId, text, children }: TooltipProps) => {
  const opacity = useSharedValue(0);
  const reduceMotion = useReduceMotion();
  const { isDismissed, dismiss } = useTooltipStore();

  const dismissed = isDismissed(tooltipId);

  const animatedBubbleStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  useEffect(() => {
    if (!dismissed) {
      if (reduceMotion) {
        opacity.value = 1;
      } else {
        opacity.value = withTiming(1, { duration: motion.duration.default });
      }
    }
  }, [dismissed, reduceMotion]);

  if (dismissed) return <>{children}</>;

  return (
    <View style={styles.container}>
      {children}
      <TouchableWithoutFeedback onPress={() => dismiss(tooltipId)}>
        <Animated.View style={[styles.bubble, animatedBubbleStyle]}>
          <Text style={styles.text}>{text}</Text>
          <View style={styles.arrow} />
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  bubble: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    alignItems: 'center',
    marginBottom: spacing[1],
    backgroundColor: colors.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[3],
    ...shadows.md,
  },
  text: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
  arrow: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.bg.surfaceRaised,
  },
});
