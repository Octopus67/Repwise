/**
 * Lighting reminder preference logic.
 *
 * Manages the "Don't show again" preference for the lighting
 * consistency reminder shown before photo capture.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'lighting_reminder_dismissed';

/**
 * Reads the lighting reminder dismissed preference from AsyncStorage.
 * Returns false if the key doesn't exist or on read failure (safe default).
 */
export async function getLightingReminderDismissed(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

/**
 * Writes the lighting reminder dismissed preference to AsyncStorage.
 */
export async function setLightingReminderDismissed(
  value: boolean,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, String(value));
}

/**
 * Returns true if the lighting reminder should be shown.
 * Shows the reminder unless the user has opted out.
 */
export async function shouldShowReminder(): Promise<boolean> {
  const dismissed = await getLightingReminderDismissed();
  return !dismissed;
}
