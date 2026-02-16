/**
 * RPEPicker — Quick-select picker for RPE/RIR values
 *
 * A compact picker that shows when user taps the RPE/RIR field in a set row.
 * Two modes:
 *   RPE mode: buttons [6] [7] [8] [9] [10]
 *   RIR mode: buttons [4+] [3] [2] [1] [0]
 *
 * Tapping a value calls onSelect(value) and dismisses.
 *
 * Pure conversion functions are in app/utils/rpeConversion.ts for testability.
 *
 * Task: 3c.1
 */

import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import {
  RPE_VALUES,
  RIR_VALUES,
  rirToRpe,
  getRirDisplayLabel,
} from '../../utils/rpeConversion';

// Re-export pure functions so existing imports still work
export {
  RPE_VALUES,
  RIR_VALUES,
  rirToRpe,
  rpeToRir,
  getRirDisplayLabel,
  getDisplayValue,
} from '../../utils/rpeConversion';

// ─── Component ───────────────────────────────────────────────────────────────

interface RPEPickerProps {
  visible: boolean;
  mode: 'rpe' | 'rir';
  onSelect: (rpeValue: string) => void;
  onDismiss: () => void;
}

export function RPEPicker({ visible, mode, onSelect, onDismiss }: RPEPickerProps) {
  const values = mode === 'rpe' ? RPE_VALUES : RIR_VALUES;

  const handleSelect = (value: number) => {
    // Always store as RPE
    const rpeValue = mode === 'rir' ? rirToRpe(value) : value;
    onSelect(String(rpeValue));
  };

  const getLabel = (value: number): string => {
    if (mode === 'rir') return getRirDisplayLabel(value);
    return String(value);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onDismiss}>
        <View style={styles.pickerContainer}>
          <Text style={styles.modeLabel}>{mode === 'rpe' ? 'RPE' : 'RIR'}</Text>
          <View style={styles.buttonRow}>
            {values.map((value) => (
              <TouchableOpacity
                key={value}
                style={styles.valueButton}
                onPress={() => handleSelect(value)}
              >
                <Text style={styles.valueText}>{getLabel(value)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerContainer: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    padding: spacing[4],
    minWidth: 280,
    alignItems: 'center',
  },
  modeLabel: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[3],
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  valueButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  valueText: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});
