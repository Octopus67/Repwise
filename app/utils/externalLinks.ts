import { Linking, Platform } from 'react-native';

export const TELEGRAM_URL = 'https://t.me/repwiseCommunity';

export const openTelegramLink = () => {
  if (Platform.OS === 'web') {
    window.open(TELEGRAM_URL, '_blank');
  } else {
    Linking.openURL(TELEGRAM_URL);
  }
};

// Deferred: Replace with actual Calendly link before launch
export const COACHING_BOOKING_URL = 'https://calendly.com/repwise-coaching';

export const openCoachingBooking = () => {
  if (Platform.OS === 'web') {
    window.open(COACHING_BOOKING_URL, '_blank');
  } else {
    Linking.openURL(COACHING_BOOKING_URL);
  }
};
