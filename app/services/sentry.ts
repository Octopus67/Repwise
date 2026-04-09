/**
 * Sentry initialization for React Native.
 * Call initSentry() once at app startup, before rendering.
 */

import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

/** Initialize Sentry error tracking. No-op if DSN is empty or on web (uses mock). */
export function initSentry(): void {
  if (!DSN || Platform.OS === 'web') return;

  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.2,
    environment: __DEV__ ? 'development' : 'production',
    enabled: !__DEV__,
  });
}

export { Sentry };
