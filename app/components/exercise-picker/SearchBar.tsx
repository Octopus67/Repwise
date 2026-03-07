import React from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../common/Icon';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  resultCount: number | null;
}

export function SearchBar({ value, onChangeText, onClear, resultCount }: SearchBarProps) {
  const c = useThemeColors();
  return (
    <View style={[styles.container, { backgroundColor: c.bg.base }]}>
      <View style={[styles.inputRow, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}>
        <TextInput
          style={[styles.input, { color: c.text.primary }]}
          value={value}
          onChangeText={onChangeText}
          placeholder="Search exercises..."
          placeholderTextColor={c.text.muted}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search exercises"
        />
        {value.length > 0 && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={onClear}
            accessibilityLabel="Clear search"
            accessibilityRole="button"
          >
            <Icon name="close" size={16} color={c.text.muted} />
          </TouchableOpacity>
        )}
      </View>
      {resultCount != null && resultCount > 0 && (
        <Text style={[styles.resultCount, { color: c.text.muted }]}>{resultCount} exercises</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    backgroundColor: colors.bg.base,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.size.base,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  clearBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  clearText: {},
  resultCount: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    marginTop: spacing[1],
  },
});
