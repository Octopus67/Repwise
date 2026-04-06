import { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { typography, spacing, letterSpacing } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Button } from './Button';

// Lottie: try/catch for graceful fallback
let LottieView: any = null;
try { LottieView = require('lottie-react-native'); } catch { /* not installed */ }

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
  lottieSource?: any;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  children,
  lottieSource,
}: EmptyStateProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      {lottieSource && LottieView ? (
        <View style={styles.lottieWrap}>
          <LottieView source={lottieSource} autoPlay loop style={styles.lottie} />
        </View>
      ) : (
        <View style={styles.iconWrap} accessibilityLabel={`${title} illustration`}>{icon}</View>
      )}
      <Text style={[styles.title, { color: c.text.secondary }]}>{title}</Text>
      <Text style={[styles.description, { color: c.text.muted }]}>{description}</Text>
      {children}
      {actionLabel ? (
        <Button
          title={actionLabel}
          onPress={onAction ?? (() => {})}
          variant="primary"
          style={styles.button}
        />
      ) : null}
    </Animated.View>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[6],
  },
  iconWrap: {
    marginBottom: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
  },
  lottieWrap: {
    marginBottom: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
  },
  lottie: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: c.text.secondary,
    letterSpacing: letterSpacing.tight,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  description: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.regular,
    color: c.text.muted,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  button: {
    marginTop: spacing[2],
  },
});
