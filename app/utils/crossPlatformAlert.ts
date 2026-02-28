/**
 * Cross-Platform Alert Utility
 *
 * On iOS/Android, delegates to React Native's Alert.alert.
 * On web (Expo web), uses window.confirm / window.alert since
 * Alert.alert doesn't render native dialogs on web — it either
 * silently fails or falls back to window.confirm (OK/Cancel only).
 */

import { Platform, Alert } from 'react-native';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

/**
 * Show an alert dialog that works on iOS, Android, AND web.
 *
 * - 0–1 buttons → window.alert (informational)
 * - 2 buttons   → window.confirm (OK = non-cancel button)
 * - 3+ buttons  → window.confirm (OK = destructive or first non-cancel)
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons as any);
    return;
  }

  // ── Web path ──
  const msg = message ? `${title}\n${message}` : title;

  if (!buttons || buttons.length <= 1) {
    window.alert(msg);
    buttons?.[0]?.onPress?.();
    return;
  }

  if (buttons.length === 2) {
    const result = window.confirm(msg);
    if (result) {
      const actionBtn = buttons.find((b) => b.style !== 'cancel');
      actionBtn?.onPress?.();
    } else {
      const cancelBtn = buttons.find((b) => b.style === 'cancel');
      cancelBtn?.onPress?.();
    }
    return;
  }

  // 3+ buttons: confirm maps OK to destructive/primary action
  const result = window.confirm(msg);
  if (result) {
    const actionBtn =
      buttons.find((b) => b.style === 'destructive') ??
      buttons.find((b) => b.style !== 'cancel');
    actionBtn?.onPress?.();
  } else {
    const cancelBtn = buttons.find((b) => b.style === 'cancel');
    cancelBtn?.onPress?.();
  }
}
