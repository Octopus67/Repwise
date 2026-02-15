/**
 * PostHog analytics service for React Native.
 *
 * Wraps PostHog SDK calls. Fire-and-forget — failures are silently ignored.
 * SDK initialisation happens in App.tsx at boot.
 *
 * NOTE: posthog-react-native is listed as a peer dependency reference.
 * Install with: npx expo install posthog-react-native
 */

// PostHog client placeholder — will be set after SDK init
let posthog: any = null;

export function initAnalytics(apiKey: string | undefined, host = 'https://app.posthog.com') {
  if (!apiKey) return;
  try {
    // Dynamic import to avoid crash if SDK not installed yet
    const PostHog = require('posthog-react-native');
    posthog = new PostHog.PostHog(apiKey, { host });
  } catch {
    // SDK not installed — analytics disabled
  }
}

function capture(event: string, properties?: Record<string, unknown>) {
  try {
    posthog?.capture(event, properties);
  } catch {
    // fire-and-forget
  }
}

export function trackPageView(screen: string) {
  capture('$screen', { $screen_name: screen });
}

export function trackUserRegistered() {
  capture('user.registered');
}

export function trackUserLoggedIn(method: string = 'email') {
  capture('user.logged_in', { method });
}

export function trackSubscriptionCreated(planId: string, currency: string) {
  capture('subscription.created', { plan_id: planId, currency });
}

export function trackArticleRead(articleId: string) {
  capture('article.read', { article_id: articleId });
}

export function trackCoachingRequested() {
  capture('coaching.requested');
}

export function trackFeatureUsed(feature: string) {
  capture('feature.used', { feature });
}
