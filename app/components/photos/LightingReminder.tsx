/**
 * LightingReminder — dismissible card with lighting guidance text.
 *
 * Shown between pose selection and camera open. Includes a
 * "Don't show again" toggle that persists the preference.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Switch } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import {
  shouldShowReminder,
  setLightingReminderDismissed,
} from '../../utils/lightingReminderLogic';

interface LightingReminderProps {
  visible: boolean;
  onDismiss: () => void;
  onDontShowAgain: () => void;
}

export function LightingReminder({ visible, onDismiss, onDontShowAgain }: LightingReminderProps) {
  const [dontShow, setDontShow] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    if (visible) {
      shouldShowReminder().then((show) => {
        if (!show) {
          // Auto-skip: user previously opted out
          onDismiss();
          setShouldRender(false);
        } else {
          setShouldRender(true);
        }
      });
    }
  }, [visible]);

  const handleDismiss = async () => {
    if (dontShow) {
      await setLightingReminderDismissed(true);
      onDontShowAgain();
    }
    onDismiss();
  };

  if (!shouldRender) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.icon}>💡</Text>
          <Text style={styles.title}>Lighting Tip</Text>
          <Text style={styles.body}>
            For the best comparison results, try to use the same room, same time of day, and prefer
            natural light for each photo session.
          </Text>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Don't show again</Text>
            <Switch
              value={dontShow}
              onValueChange={setDontShow}
              trackColor={{ false: colors.bg.surfaceRaised, true: colors.accent.primary }}
              thumbColor={colors.text.primary}
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleDismiss} activeOpacity={0.8}>
            <Text style={styles.buttonText}>Got it</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
  },
  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.lg,
    padding: spacing[6],
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  icon: {
    fontSize: 40,
    marginBottom: spacing[3],
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[2],
  },
  body: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    textAlign: 'center',
    lineHeight: typography.size.base * typography.lineHeight.relaxed,
    marginBottom: spacing[4],
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing[4],
    paddingHorizontal: spacing[2],
  },
  toggleLabel: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
  },
  button: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[8],
  },
  buttonText: {
    color: colors.text.inverse,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
});
