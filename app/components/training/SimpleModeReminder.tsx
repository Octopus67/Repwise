/**
 * SimpleModeReminder — Dismissible banner nudging users to enable Simple Mode during workouts.
 */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useWorkoutPreferencesStore } from '../../store/workoutPreferencesStore';
import { capture } from '../../services/analytics';

interface Props { onOpenPreferences: () => void }

export function SimpleModeReminder({ onOpenPreferences }: Props) {
  const c = useThemeColors();
  const { simpleMode, simpleModeDiscoveryCount } = useWorkoutPreferencesStore();

  if (simpleMode || simpleModeDiscoveryCount >= 3) return null;

  const dismiss = () => {
    useWorkoutPreferencesStore.setState((s) => ({
      simpleModeDiscoveryCount: s.simpleModeDiscoveryCount + 1,
    }));
    capture('simple_mode_reminder_dismissed');
  };

  return (
    <View style={[s.banner, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}>
      <TouchableOpacity style={s.body} onPress={onOpenPreferences} accessibilityRole="button">
        <Text style={[s.text, { color: c.text.secondary }]}>
          💡 Turn on Smart Feedback to see when you've done enough
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={dismiss} accessibilityLabel="Dismiss" hitSlop={8}>
        <Text style={[s.x, { color: c.text.muted }]}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', padding: spacing[3], borderRadius: radius.md, borderWidth: 1, marginHorizontal: spacing[4], marginBottom: spacing[2] },
  body: { flex: 1 },
  text: { fontSize: typography.size.sm },
  x: { fontSize: typography.size.base, paddingLeft: spacing[2] },
});
