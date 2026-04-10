/**
 * Alert retry utility — shows a dismissable alert with a retry option.
 * Used for critical error paths where the user should be offered a retry.
 */

import { Alert } from 'react-native';

export function showRetryAlert(title: string, message: string, retryFn: () => void) {
  Alert.alert(title, message, [
    { text: 'Dismiss', style: 'cancel' },
    { text: 'Retry', onPress: retryFn },
  ]);
}
