import React from 'react';
import { useGatedFeature } from '../../hooks/useGatedFeature';

interface FeatureGateProps {
  flag: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Conditionally render children based on a PostHog feature flag.
 * Fails open — renders children if PostHog is unavailable.
 * At launch all features are free; flip flags in PostHog dashboard to gate.
 */
export function FeatureGate({ flag, children, fallback }: FeatureGateProps) {
  const { enabled, loading } = useGatedFeature(flag);
  if (loading) return null;
  if (!enabled) return <>{fallback ?? null}</>;
  return <>{children}</>;
}
