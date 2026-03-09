/**
 * LightingReminder — dismissible card with lighting guidance text.
 *
 * Shown between pose selection and camera open. Includes a
 * "Don't show again" toggle that persists the preference.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Switch } from 'react-native';
import { radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
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
  const c = useThemeColors();
  const styles = getThemedStyles(c);
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
      <View style={[styles.backdrop, { backgroundColor: c.bg.overlay }]}>
        <View style={[styles.card, { backgroundColor: c.bg.surface }]}>
          <Text style={styles.icon}>💡</Text>
          <Text style={[styles.title, { color: c.text.primary }]}>Lighting Tip</Text>
          <Text style={[styles.body, { color: c.text.secondary }]}>
            For the best comparison results, try to use the same room, same time of day, and prefer
            natural light for each photo session.
          </Text>

          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: c.text.secondary }]}>Don't show again</Text>
            <Switch
              value={dontShow}
              onValueChange={setDontShow}
              trackColor={{ false: c.bg.surfaceRaised, true: c.accent.primary }}
              thumbColor={c.text.primary}
            />
          </View>

          <TouchableOpacity style={[styles.button, { backgroundColor: c.accent.primary }]} onPress={handleDismiss} activeOpacity={0.8}>
            <Text style={[styles.buttonText, { color: c.text.inverse }]}>Got it</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
  },
  card: {
    backgroundColor: c.bg.surface,
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
    color: c.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[2],
  },
  body: {
    color: c.text.secondary,
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
    color: c.text.secondary,
    fontSize: typography.size.sm,
  },
  button: {
    backgroundColor: c.accent.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[8],
  },
  buttonText: {
    color: c.text.inverse,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
});
