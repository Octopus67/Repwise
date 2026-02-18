import { useCallback } from 'react';
import { useReduceMotion } from './useReduceMotion';

type ImpactStyle = 'light' | 'medium' | 'heavy';

/**
 * Hook that provides haptic feedback functions gated by reduce-motion.
 * When reduce-motion is enabled, haptics are suppressed.
 */
export function useHaptics() {
  const reduceMotion = useReduceMotion();

  const impact = useCallback(
    (style: ImpactStyle = 'light') => {
      if (reduceMotion) return;
      try {
        const Haptics = require('expo-haptics');
        const styleMap: Record<ImpactStyle, string> = {
          light: 'Light',
          medium: 'Medium',
          heavy: 'Heavy',
        };
        Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle[styleMap[style]])?.catch?.(() => {});
      } catch {
        // expo-haptics not available
      }
    },
    [reduceMotion],
  );

  const notification = useCallback(
    (type: 'success' | 'warning' | 'error' = 'success') => {
      if (reduceMotion) return;
      try {
        const Haptics = require('expo-haptics');
        const typeMap: Record<string, string> = {
          success: 'Success',
          warning: 'Warning',
          error: 'Error',
        };
        Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType[typeMap[type]])?.catch?.(() => {});
      } catch {
        // expo-haptics not available
      }
    },
    [reduceMotion],
  );

  return { impact, notification };
}

/**
 * Standalone haptic trigger (for use outside React components).
 * Does NOT check reduce-motion — callers should check themselves.
 */
export function triggerHaptic(style: ImpactStyle = 'light') {
  try {
    const Haptics = require('expo-haptics');
    const styleMap: Record<ImpactStyle, string> = {
      light: 'Light',
      medium: 'Medium',
      heavy: 'Heavy',
    };
    Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle[styleMap[style]])?.catch?.(() => {});
  } catch {
    // expo-haptics not available
  }
}
