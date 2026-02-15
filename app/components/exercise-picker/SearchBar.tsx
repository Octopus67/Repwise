import React from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Icon } from '../common/Icon';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  resultCount: number | null;
}

export function SearchBar({ value, onChangeText, onClear, resultCount }: SearchBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder="Search exercises..."
          placeholderTextColor={colors.text.muted}
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
            <Icon name="close" size={16} color={colors.text.muted} />
          </TouchableOpacity>
        )}
      </View>
      {resultCount != null && resultCount > 0 && (
        <Text style={styles.resultCount}>{resultCount} exercises</Text>
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
