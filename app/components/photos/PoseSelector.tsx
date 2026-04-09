/**
 * PoseSelector — modal presenting four pose type options as tappable cards.
 *
 * Shown when the user initiates photo capture, before opening the camera.
 */

import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../common/Icon';
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
  front_double_bicep: 'muscle',
  side: '🚶',
  back: '🔙',
};

export function PoseSelector({ visible, onSelect, onCancel }: PoseSelectorProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={[styles.backdrop, { backgroundColor: c.bg.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: c.bg.surface }]}>
          <Text style={[styles.title, { color: c.text.primary }]}>Select Pose</Text>
          <Text style={[styles.subtitle, { color: c.text.secondary }]}>Choose a pose for consistent tracking</Text>

          <View style={styles.grid}>
            {POSE_TYPES.map((pose) => (
              <TouchableOpacity
                key={pose}
                style={[styles.card, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.subtle }]}
                onPress={() => onSelect(pose)}
                activeOpacity={0.7}
              >
                {POSE_ICONS[pose] === 'muscle' ? <Icon name="muscle" size={32} color={c.accent.primary} /> : <Text style={styles.icon}>{POSE_ICONS[pose]}</Text>}
                <Text style={[styles.label, { color: c.text.primary }]}>{POSE_LABELS[pose]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={[styles.cancelText, { color: c.text.secondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: c.bg.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.bg.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  title: {
    color: c.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    marginBottom: spacing[1],
  },
  subtitle: {
    color: c.text.secondary,
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
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing[4],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  icon: {
    fontSize: 32,
    marginBottom: spacing[2],
  },
  label: {
    color: c.text.primary,
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
    color: c.text.secondary,
    fontSize: typography.size.base,
  },
});
