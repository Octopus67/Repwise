/**
 * SimpleModeDiscoveryModal — Nudges users to enable Simple Mode after first workout.
 * Shows up to 3 times on WorkoutSummaryScreen if simpleMode is off.
 */

import { useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useWorkoutPreferencesStore } from '../../store/workoutPreferencesStore';
import { capture } from '../../services/analytics';

const DOTS = [
  { color: '#6B7280', shape: '○', label: 'Not enough yet' },
  { color: '#F59E0B', shape: '◆', label: 'Getting close' },
  { color: '#22C55E', shape: '●', label: 'Enough stimulus' },
  { color: '#EF4444', shape: '▲', label: 'Too much — stop' },
] as const;

interface Props { visible: boolean; onClose: () => void }

export function SimpleModeDiscoveryModal({ visible, onClose }: Props) {
  const c = useThemeColors();
  const toggleSimpleMode = useWorkoutPreferencesStore((s) => s.toggleSimpleMode);

  useEffect(() => {
    if (visible) capture('simple_mode_discovery_shown');
  }, [visible]);

  const handleAccept = () => {
    toggleSimpleMode();
    capture('simple_mode_discovery_accepted');
    onClose();
  };

  const handleDismiss = () => {
    useWorkoutPreferencesStore.setState((s) => ({
      simpleModeDiscoveryCount: s.simpleModeDiscoveryCount + 1,
    }));
    capture('simple_mode_discovery_dismissed');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose} // Audit fix 4.3 — Android back button
    >
      <View style={[s.overlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
        <View style={[s.card, { backgroundColor: c.bg.surface }]}>
          <Text style={[s.title, { color: c.text.primary }]}>Smart Workout Feedback</Text>
          <Text style={[s.subtitle, { color: c.text.secondary }]}>
            Know exactly when you've done enough
          </Text>

          <View style={s.dots}>
            {DOTS.map((d) => (
              <View key={d.label} style={s.dotRow}>
                <Text style={[s.shape, { color: d.color }]}>{d.shape}</Text>
                <Text style={[s.dotLabel, { color: c.text.muted }]}>{d.label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[s.cta, { backgroundColor: c.accent.primary }]}
            onPress={handleAccept}
            accessibilityRole="button"
            accessibilityLabel="Turn on smart feedback"
          >
            <Text style={[s.ctaText, { color: c.text.inverse }]}>Turn On</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDismiss} accessibilityRole="button" style={s.skip}>
            <Text style={[s.skipText, { color: c.text.muted }]}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[6] },
  card: { width: '100%', borderRadius: radius.lg, padding: spacing[6], alignItems: 'center' },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.semibold, marginBottom: spacing[2] },
  subtitle: { fontSize: typography.size.base, textAlign: 'center', marginBottom: spacing[6] },
  dots: { gap: spacing[3], width: '100%', marginBottom: spacing[6] },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  shape: { fontSize: 16, width: 18, textAlign: 'center' },
  dotLabel: { fontSize: typography.size.sm },
  cta: { width: '100%', paddingVertical: spacing[3], borderRadius: radius.md, alignItems: 'center' },
  ctaText: { fontSize: typography.size.base, fontWeight: typography.weight.semibold },
  skip: { marginTop: spacing[3], paddingVertical: spacing[2] },
  skipText: { fontSize: typography.size.sm },
});
