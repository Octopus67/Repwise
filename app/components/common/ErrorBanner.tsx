import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { colors, spacing, radius, typography } from '../../theme/tokens';
import { Icon } from './Icon';

type ErrorBannerVariant = 'error' | 'warning' | 'info';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  variant?: ErrorBannerVariant;
  testID?: string;
}

const variantConfig: Record<ErrorBannerVariant, { bg: string; accent: string; icon: string }> = {
  error: {
    bg: colors.semantic.negativeSubtle,
    accent: colors.semantic.negative,
    icon: 'alert-circle',
  },
  warning: {
    bg: colors.semantic.warningSubtle,
    accent: colors.semantic.warning,
    icon: 'alert-triangle',
  },
  info: {
    bg: colors.accent.primaryMuted,
    accent: colors.accent.primary,
    icon: 'info',
  },
};

export function ErrorBanner({
  message,
  onRetry,
  onDismiss,
  variant = 'error',
  testID,
}: ErrorBannerProps) {
  const config = variantConfig[variant];

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={[styles.container, { backgroundColor: config.bg }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      testID={testID}
    >
      <Icon name={config.icon as any} size={20} color={config.accent} />
      <Text style={styles.message} numberOfLines={3}>
        {message}
      </Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          style={styles.retryButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
      {onDismiss && (
        <TouchableOpacity
          onPress={onDismiss}
          style={styles.dismissButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Icon name="x" size={16} color={colors.text.muted} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: radius.sm,
    marginHorizontal: spacing[4],
    marginVertical: spacing[2],
  },
  message: {
    flex: 1,
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.regular,
    lineHeight: typography.lineHeight.sm,
    marginLeft: spacing[2],
  },
  retryButton: {
    marginLeft: spacing[3],
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: colors.accent.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  dismissButton: {
    marginLeft: spacing[2],
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
