import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemeColors } from '../../hooks/useThemeColors';
import { spacing, typography } from '../../theme/tokens';

interface QuickAddModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targetDate: string;
}

export function QuickAddModal({ visible, onClose, onSuccess, targetDate }: QuickAddModalProps) {
  const colors = useThemeColors();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.bg.base }]}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Quick Add</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={{ color: colors.text.secondary }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  container: { padding: spacing[4], borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  title: { fontSize: typography.size.lg, fontWeight: '600', marginBottom: spacing[4] },
});
