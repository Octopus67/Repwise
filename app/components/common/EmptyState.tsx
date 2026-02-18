import { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, letterSpacing } from '../../theme/tokens';
import { Button } from './Button';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  children,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap} accessibilityLabel={`${title} illustration`}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {children}
      {actionLabel ? (
        <Button
          title={actionLabel}
          onPress={onAction ?? (() => {})}
          variant="primary"
          style={styles.button}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.text.secondary,
    letterSpacing: letterSpacing.tight,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  description: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.regular,
    color: colors.text.muted,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  button: {
    marginTop: spacing[2],
  },
});
