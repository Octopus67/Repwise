import { useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, spacing, typography, radius, letterSpacing as ls } from '../../theme/tokens';
import { Icon } from '../common/Icon';
import { Button } from '../common/Button';

interface ShareableCardProps {
  title: string;
  description: string;
  icon: string;
  unlockedAt: string;
  onShare?: () => void;
}

export function ShareableCard({
  title,
  description,
  icon,
  unlockedAt,
  onShare,
}: ShareableCardProps) {
  const cardRef = useRef<View>(null);

  const handleShare = async () => {
    try {
      onShare?.();
    } catch {
      // share sheet unavailable — silent fail
    }
  };

  return (
    <View>
      <View ref={cardRef} style={styles.card}>
        <View style={styles.iconCircle}>
          <Icon name="trophy" size={28} color={colors.accent.primary} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <Text style={styles.date}>
          Unlocked {new Date(unlockedAt).toLocaleDateString(undefined, {
            month: 'long', day: 'numeric', year: 'numeric',
          })}
        </Text>
        <Text style={styles.branding}>HypertrophyOS</Text>
      </View>
      {Platform.OS !== 'web' && onShare && (
        <Button title="Share" onPress={handleShare} style={styles.shareBtn} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[6],
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
    marginBottom: spacing[1],
  },
  description: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  date: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    marginBottom: spacing[3],
  },
  branding: {
    color: colors.accent.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    letterSpacing: ls.wider,
  },
  shareBtn: {
    marginTop: spacing[3],
  },
});
