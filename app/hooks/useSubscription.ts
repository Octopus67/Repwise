import { useState, useEffect, useCallback } from 'react';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import {
  getOfferings,
  checkSubscriptionStatus,
  purchasePackage,
  restorePurchases,
} from '../services/purchases';

export function useSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [status, current] = await Promise.all([
          checkSubscriptionStatus(),
          getOfferings(),
        ]);
        if (!mounted) return;
        setIsSubscribed(status.isSubscribed);
        setOfferings(current);
      } catch (e) {
        console.warn('[useSubscription] init failed:', e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const purchase = useCallback(async (pkg: PurchasesPackage) => {
    const { customerInfo } = await purchasePackage(pkg);
    const active = !!customerInfo.entitlements.active['premium'];
    setIsSubscribed(active);
    return active;
  }, []);

  const restore = useCallback(async () => {
    const info = await restorePurchases();
    const active = !!info?.entitlements.active['premium'];
    setIsSubscribed(active);
    return active;
  }, []);

  return { isSubscribed, isLoading, offerings, purchase, restore };
}
