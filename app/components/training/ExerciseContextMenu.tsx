import { View, Text, TouchableOpacity, TouchableWithoutFeedback, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography, shadows } from '../../theme/tokens';

export interface ExerciseContextMenuProps {
  visible: boolean;
  isSkipped: boolean;
  hasNotes: boolean;
  hasPreviousPerformance: boolean;
  onSwap: () => void;
  onSkip: () => void;
  onUnskip: () => void;
  onAddNote: () => void;
  onGenerateWarmUp: () => void;
  onDismiss: () => void;
}

export function ExerciseContextMenu({
  visible,
  isSkipped,
  hasNotes,
  hasPreviousPerformance,
  onSwap,
  onSkip,
  onUnskip,
  onAddNote,
  onGenerateWarmUp,
  onDismiss,
}: ExerciseContextMenuProps) {
  if (!visible) return null;

  const items: { label: string; onPress: () => void }[] = [
    { label: 'Swap Exercise', onPress: onSwap },
    { label: isSkipped ? 'Unskip Exercise' : 'Skip Exercise', onPress: isSkipped ? onUnskip : onSkip },
    { label: hasNotes ? 'Edit Note' : 'Add Note', onPress: onAddNote },
  ];

  if (hasPreviousPerformance) {
    items.push({ label: 'Generate Warm-Up', onPress: onGenerateWarmUp });
  }

  const handleItemPress = (action: () => void) => {
    action();
    onDismiss();
  };

  return (
    <>
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={styles.menu}>
        {items.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.menuItem, index < items.length - 1 && styles.menuItemBorder]}
            onPress={() => handleItemPress(item.onPress)}
            activeOpacity={0.7}
          >
            <Text style={styles.menuItemText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
    zIndex: 99,
  },
  menu: {
    position: 'absolute',
    right: 0,
    top: '100%',
    zIndex: 100,
    backgroundColor: colors.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    minWidth: 200,
    overflow: 'hidden',
    ...shadows.lg,
  },
  menuItem: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  menuItemText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
});
