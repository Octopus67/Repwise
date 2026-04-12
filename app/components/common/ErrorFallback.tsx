import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getThemeColors } from '../../hooks/useThemeColors';
import { spacing, typography } from '../../theme/tokens';

interface Props {
  error: Error;
  onReset: () => void;
}

/** Navigation-level crash recovery screen. Shown when the entire nav tree fails. */
export function ErrorFallback({ error, onReset }: Props) {
  const c = getThemeColors();
  return (
    <View style={[styles.container, { backgroundColor: c.bg.base }]}>
      <Text style={[styles.title, { color: c.text.primary }]}>Repwise</Text>
      <Text style={[styles.subtitle, { color: c.text.secondary }]}>Something went wrong</Text>
      <Text style={[styles.error, { color: c.semantic.negative }]}>{error.message}</Text>
      <TouchableOpacity style={[styles.button, { backgroundColor: c.accent.primary }]} onPress={onReset}>
        <Text style={styles.buttonText}>Restart</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6] },
  title: { fontSize: typography.size['2xl'], fontWeight: '700', marginBottom: spacing[2] },
  subtitle: { fontSize: typography.size.lg, marginBottom: spacing[4] },
  error: { fontSize: typography.size.sm, textAlign: 'center', marginBottom: spacing[6] },
  button: { paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: typography.size.base, fontWeight: '600' },
});
