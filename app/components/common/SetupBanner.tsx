import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Icon } from './Icon';

interface SetupBannerProps {
  onPress: () => void;
}

export function SetupBanner({ onPress }: SetupBannerProps) {
  return (
    <TouchableOpacity style={styles.banner} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.content}>
        <Icon name="lightning" size={18} color={colors.accent.primary} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>Complete your profile to get personalized targets</Text>
          <Text style={styles.subtitle}>Tap to set up your goals and body stats</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent.primary,
    marginBottom: spacing[4],
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    gap: spacing[3],
  },
  icon: {},
  textContainer: {
    flex: 1,
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  subtitle: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    marginTop: 2,
  },
  arrow: {
    color: colors.accent.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
  },
});
