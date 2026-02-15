/**
 * PoseSelector — modal presenting four pose type options as tappable cards.
 *
 * Shown when the user initiates photo capture, before opening the camera.
 */

import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { PoseType, POSE_TYPES } from '../../utils/progressPhotoTypes';

interface PoseSelectorProps {
  visible: boolean;
  onSelect: (poseType: PoseType) => void;
  onCancel: () => void;
}

const POSE_LABELS: Record<PoseType, string> = {
  front_relaxed: 'Front Relaxed',
  front_double_bicep: 'Front Double Bicep',
  side: 'Side',
  back: 'Back',
};

const POSE_ICONS: Record<PoseType, string> = {
  front_relaxed: '🧍',
  front_double_bicep: '💪',
  side: '🚶',
  back: '🔙',
};

export function PoseSelector({ visible, onSelect, onCancel }: PoseSelectorProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Select Pose</Text>
          <Text style={styles.subtitle}>Choose a pose for consistent tracking</Text>

          <View style={styles.grid}>
            {POSE_TYPES.map((pose) => (
              <TouchableOpacity
                key={pose}
                style={styles.card}
                onPress={() => onSelect(pose)}
                activeOpacity={0.7}
              >
                <Text style={styles.icon}>{POSE_ICONS[pose]}</Text>
                <Text style={styles.label}>{POSE_LABELS[pose]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.bg.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    marginBottom: spacing[1],
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    justifyContent: 'center',
  },
  card: {
    width: '46%',
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing[4],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  icon: {
    fontSize: 32,
    marginBottom: spacing[2],
  },
  label: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    textAlign: 'center',
  },
  cancelBtn: {
    marginTop: spacing[4],
    alignItems: 'center',
    padding: spacing[3],
  },
  cancelText: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
  },
});
