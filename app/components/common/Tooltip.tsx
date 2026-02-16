import { useRef, useEffect } from 'react';
import { View, Text, TouchableWithoutFeedback, StyleSheet, Animated } from 'react-native';
import { useTooltipStore } from '../../store/tooltipStore';
import { colors, radius, spacing, typography, shadows } from '../../theme/tokens';

interface TooltipProps {
  tooltipId: string;
  text: string;
  children: React.ReactNode;
}

export const Tooltip = ({ tooltipId, text, children }: TooltipProps) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const { isDismissed, dismiss } = useTooltipStore();

  const dismissed = isDismissed(tooltipId);

  useEffect(() => {
    if (!dismissed) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [dismissed]);

  if (dismissed) return <>{children}</>;

  return (
    <View style={styles.container}>
      {children}
      <TouchableWithoutFeedback onPress={() => dismiss(tooltipId)}>
        <Animated.View style={[styles.bubble, { opacity }]}>
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
