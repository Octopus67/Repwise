/**
 * RestTimerBar — Floating collapsed rest-timer bar.
 *
 * Docked above FinishBar. Shows compact ring + remaining time + Skip button.
 * Tap anywhere (except Skip) to expand back to full overlay.
 * Slides up from bottom with spring animation on mount.
 */

import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { RestTimerRing } from './RestTimerRing';
import { formatRestTimer } from '../../utils/durationFormat';
import { colors, spacing, typography, shadows, radius } from '../../theme/tokens';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface RestTimerBarProps {
  durationSeconds: number;
  remainingSeconds: number;
  paused: boolean;
  completed: boolean;
  onSkip: () => void;
  onExpand: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RestTimerBar({
  durationSeconds,
  remainingSeconds,
  paused,
  completed,
  onSkip,
  onExpand,
}: RestTimerBarProps) {
  const slideAnim = useRef(new Animated.Value(56)).current; // start off-screen (bar height)

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 200,
      mass: 0.5,
    }).start();
  }, []);

  const timeLabel = completed
    ? 'Rest Complete'
    : formatRestTimer(remainingSeconds);

  const timeLabelColor = completed
    ? colors.semantic.positive
    : colors.text.primary;

  return (
    <Animated.View style={[styles.bar, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity
        style={styles.content}
        activeOpacity={0.7}
        onPress={onExpand}
        accessibilityRole="button"
        accessibilityLabel="Expand rest timer"
      >
        <RestTimerRing
          durationSeconds={durationSeconds}
          remainingSeconds={remainingSeconds}
          paused={paused}
          size={40}
        />

        <Text style={[styles.timeText, { color: timeLabelColor }]}>
          {timeLabel}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onSkip}
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Skip rest timer"
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    backgroundColor: colors.bg.surfaceRaised,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    ...shadows.md,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  timeText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  skipText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.text.muted,
  },
});
