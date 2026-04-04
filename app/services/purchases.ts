// RevenueCat SDK integration for iOS (Apple IAP) and Android (Google Play)
// Install: npx expo install react-native-purchases
import { Platform } from 'react-native';

const RC_IOS_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '';
const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '';

let isConfigured = false;

export async function configurePurchases(appUserID: string) {
  try {
    const { default: Purchases } = await import('react-native-purchases');
    const apiKey = Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;
    if (!apiKey) {
      console.error('[Repwise] RevenueCat API key not configured for', Platform.OS, '- payments will not work');
      return;
    }
    Purchases.configure({ apiKey, appUserID });
    isConfigured = true;
  } catch (e) {
    console.warn('[RevenueCat] SDK not available:', e);
  }
}

export async function getOfferings() {
  if (!isConfigured) return null;
  try {
    const { default: Purchases } = await import('react-native-purchases');
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (e) {
    console.warn('[RevenueCat] Failed to get offerings:', e);
    return null;
  }
}

export async function purchasePackage(pkg: { identifier: string; [key: string]: unknown }) {
  if (!isConfigured) throw new Error('RevenueCat not configured');
  const { default: Purchases } = await import('react-native-purchases');
  const { customerInfo } = await Purchases.purchasePackage(pkg as unknown as Parameters<typeof Purchases.purchasePackage>[0]);
  return customerInfo;
}

export async function restorePurchases() {
  if (!isConfigured) return null;
  const { default: Purchases } = await import('react-native-purchases');
  return Purchases.restorePurchases();
}

export async function getCustomerInfo() {
  if (!isConfigured) return null;
  const { default: Purchases } = await import('react-native-purchases');
  return Purchases.getCustomerInfo();
}
