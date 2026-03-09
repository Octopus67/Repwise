/**
 * OverloadSuggestionBadge — Progressive overload suggestion display
 *
 * Displays below exercise name in ActiveWorkoutScreen:
 * "💡 Try {weight}{unit} × {reps} ({reasoning})"
 *
 * Dismissible via X button. Non-blocking — user can ignore.
 * Fetches suggestion from GET /exercises/{name}/overload-suggestion on mount.
 * Shows skeleton while loading, nothing if no suggestion.
 *
 * Task: 4.5
 */

import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import api from '../../services/api';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { formatSuggestionText, OverloadSuggestionData } from '../../utils/intelligenceLayerLogic';

interface OverloadSuggestionBadgeProps {
  exerciseName: string;
  unitSystem: 'metric' | 'imperial';
}

export function OverloadSuggestionBadge({ exerciseName, unitSystem }: OverloadSuggestionBadgeProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const [suggestion, setSuggestion] = useState<OverloadSuggestionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Reset dismissed state when exercise changes so the badge shows for the new exercise
    setDismissed(false);
    setSuggestion(null);
    setLoading(true);
    (async () => {
      try {
        const encoded = encodeURIComponent(exerciseName);
        const { data, status } = await api.get(`training/exercises/${encoded}/overload-suggestion`);
        if (!cancelled && status === 200 && data) {
          setSuggestion(data);
        }
      } catch {
        // 204 or error — no suggestion available
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [exerciseName]);

  if (dismissed) return null;

  // Skeleton while loading
  if (loading) {
    return (
      <View style={styles.skeleton}>
        <View style={[styles.skeletonBar, { backgroundColor: c.bg.surfaceRaised }]} />
      </View>
    );
  }

  // Nothing if no suggestion
  if (!suggestion) return null;

  const text = formatSuggestionText(suggestion, unitSystem);

  return (
    <View style={[styles.container, { backgroundColor: c.accent.primaryMuted }]}>
      <Text style={[styles.text, { color: c.accent.primary }]} numberOfLines={1}>{text}</Text>
      <TouchableOpacity
        style={styles.dismissBtn}
        onPress={() => setDismissed(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.dismissText, { color: c.text.muted }]}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.accent.primaryMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    marginTop: spacing[1],
    marginBottom: spacing[2],
  },
  text: {
    flex: 1,
    fontSize: typography.size.sm,
    color: c.accent.primary,
    fontWeight: typography.weight.medium,
  },
  dismissBtn: {
    marginLeft: spacing[2],
    padding: spacing[1],
  },
  dismissText: {
    fontSize: typography.size.xs,
    color: c.text.muted,
  },
  skeleton: {
    marginTop: spacing[1],
    marginBottom: spacing[2],
    height: 24,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  skeletonBar: {
    flex: 1,
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.sm,
  },
});
