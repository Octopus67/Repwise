import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { typography, spacing } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

interface SectionHeaderProps {
  title: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: c.text.primary }]}>{title}</Text>
      {action ? (
        <TouchableOpacity onPress={action.onPress} activeOpacity={0.7}>
          <Text style={[styles.actionLabel, { color: c.accent.primary }]}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: c.text.primary,
  },
  actionLabel: {
    fontSize: typography.size.base,
    color: c.accent.primary,
  },
});
