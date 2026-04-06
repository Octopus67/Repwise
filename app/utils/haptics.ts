/**
 * Haptic feedback utility — dead-simple API.
 * All calls are fire-and-forget (never throws).
 */
import * as Haptics from 'expo-haptics';

const noop = () => Promise.resolve();
const safe = (fn: () => Promise<void>) => () => fn().catch(noop);

export const haptic = {
  light: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  selection: safe(() => Haptics.selectionAsync()),
};
