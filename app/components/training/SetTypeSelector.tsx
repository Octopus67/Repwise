import { useCallback } from 'react';
import { Text, TouchableOpacity, StyleSheet, ActionSheetIOS, Platform } from 'react-native';
import type { SetType } from '../../types/training';
import { SET_TYPE_ABBREVIATIONS, SET_TYPE_LABELS } from '../../utils/setTypeLabels';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

// Re-export for consumers that import from the component
export { SET_TYPE_ABBREVIATIONS } from '../../utils/setTypeLabels';

interface SetTypeSelectorProps {
  value: SetType;
  onChange: (type: SetType) => void;
}

const SET_TYPE_OPTIONS: SetType[] = ['normal', 'warm-up', 'drop-set', 'amrap'];

const getSET_TYPE_COLORS = (c: ThemeColors): Record<SetType, string> => ({
  normal: c.text.secondary,
  'warm-up': c.text.muted,
  'drop-set': c.semantic.warning,
  amrap: c.accent.primary,
});

export function SetTypeSelector({ value, onChange }: SetTypeSelectorProps) {
  const c = useThemeColors();
  const handlePress = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...SET_TYPE_OPTIONS.map((t) => SET_TYPE_LABELS[t]), 'Cancel'],
          cancelButtonIndex: SET_TYPE_OPTIONS.length,
        },
        (index) => {
          if (index < SET_TYPE_OPTIONS.length) {
            onChange(SET_TYPE_OPTIONS[index]);
          }
        },
      );
    } else {
      // On Android, cycle through options on tap (simple fallback)
      const currentIdx = SET_TYPE_OPTIONS.indexOf(value);
      const nextIdx = (currentIdx + 1) % SET_TYPE_OPTIONS.length;
      onChange(SET_TYPE_OPTIONS[nextIdx]);
    }
  }, [value, onChange]);

  const pillColor = getSET_TYPE_COLORS(c)[value];

  return (
    <TouchableOpacity
      style={[styles.pill, { borderColor: pillColor }]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Set type: ${SET_TYPE_LABELS[value]}. Tap to change.`}
      accessibilityHint={Platform.OS === 'ios' ? 'Opens menu' : 'Cycles through options'}
    >
      <Text style={[styles.text, { color: pillColor }]}>
        {SET_TYPE_ABBREVIATIONS[value]}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0],
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
});
