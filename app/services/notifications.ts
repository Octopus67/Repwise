import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import api from './api';

/** Minimal navigation interface for notification deep-linking. */
interface NotificationNavigation {
  navigate(screen: string, params?: unknown): void;
}

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register device for push notifications.
 * Handles permissions, token retrieval, and backend registration.
 * Returns the Expo push token string on success, null on failure.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.warn('[Notifications] Push notifications require a physical device');
      return null;
    }

    // Create Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6C5CE7',
      });
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Permission not granted');
      return null;
    }

    // Get Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId ?? undefined,
    });
    const token = tokenData.data;

    // Register with backend
    await api.post('notifications/register-device', {
      token,
      platform: Platform.OS,
    });

    return token;
  } catch (error: unknown) {
    console.warn('[Notifications] Registration failed:', String(error));
    return null;
  }
}

/**
 * Set up notification listeners for foreground display and tap handling.
 * Returns a cleanup function to remove listeners.
 */
export function setupNotificationListeners(
  navigation: NotificationNavigation | null,
): () => void {
  // Foreground notification received
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    if (__DEV__) console.log('[Notifications] Received:', notification.request.content.title);
  });

  // User tapped notification
  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (navigation && data?.screen) {
      navigation.navigate(data.screen as string, data.params as object | undefined);
    }
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

/**
 * Handle the notification that launched the app (cold start).
 */
export async function handleInitialNotification(
  navigation: NotificationNavigation | null,
): Promise<void> {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response && navigation) {
      const data = response.notification.request.content.data;
      if (data?.screen) {
        navigation.navigate(data.screen as string, data.params as object | undefined);
      }
    }
  } catch (err) {
    console.warn('[Notifications] tap handler failed:', String(err));
  }
}
