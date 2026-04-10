// RevenueCat SDK integration for iOS (Apple IAP) and Android (Google Play)
// Install: npx expo install react-native-purchases
import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';

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

/**
 * Execute a purchase for a given package identifier.
 * Shared helper used by UpgradeModal and TrialExpirationModal.
 * @returns true if purchase succeeded and premium entitlement is active
 */
export async function executePurchase(
  offerings: import('react-native-purchases').PurchasesOffering | null,
  planKey: 'monthly' | 'yearly'
): Promise<{ success: boolean; pending: boolean; customerInfo: import('react-native-purchases').CustomerInfo | null }> {
  const Purchases = (await import('react-native-purchases')).default;
  if (!offerings) throw new Error('No offerings available');
  Sentry.addBreadcrumb({ category: 'purchase', message: `Purchase ${planKey}`, level: 'info' });

  // Resolve package from offerings
  const pkg = planKey === 'yearly'
    ? (offerings.annual ?? offerings.availablePackages.find(p => p.identifier === '$rc_annual'))
    : (offerings.monthly ?? offerings.availablePackages.find(p => p.identifier === '$rc_monthly'));

  if (!pkg) throw new Error(`Package not found for plan: ${planKey}`);

  const { customerInfo } = await Purchases.purchasePackage(pkg);
  const isActive = !!customerInfo.entitlements.active['premium'];
  Sentry.addBreadcrumb({ category: 'purchase', message: `Purchase ${planKey} ${isActive ? 'success' : 'pending'}`, level: 'info' });

  // If purchase completed but entitlement not active, it's pending (Ask to Buy)
  return {
    success: isActive,
    pending: !isActive,
    customerInfo,
  };
}

/**
 * Async fallback to verify premium status directly against RevenueCat entitlements.
 * Use when the synchronous store-based `isPremium` selector needs server-side confirmation
 * (e.g., after restore, on paywall gates for critical features).
 */
export async function hasActiveEntitlement(): Promise<boolean> {
  const info = await getCustomerInfo();
  return !!info?.entitlements.active['premium'];
}
