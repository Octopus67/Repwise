import { Linking, Platform } from 'react-native';

export const TELEGRAM_URL = 'https://t.me/repwiseCommunity';

export const openTelegramLink = () => {
  if (Platform.OS === 'web') {
    window.open(TELEGRAM_URL, '_blank');
  } else {
    Linking.openURL(TELEGRAM_URL);
  }
};
