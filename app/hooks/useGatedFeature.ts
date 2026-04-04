import { useFeatureFlag } from 'posthog-react-native';

/**
 * Evaluate a PostHog feature flag client-side.
 * Fails open (returns enabled: true) if PostHog is unavailable —
 * all features are free at launch.
 */
export function useGatedFeature(flagName: string): { enabled: boolean; loading: boolean } {
  try {
    const value = useFeatureFlag(flagName);
    // undefined means still loading or PostHog unavailable — fail open
    const enabled = value === undefined ? true : !!value;
    return { enabled, loading: value === undefined };
  } catch {
    return { enabled: true, loading: false }; // fail open if PostHog not available
  }
}
