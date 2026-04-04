/**
 * Creates an in-memory rate limiter for client-side UX protection.
 * NOTE: This resets on app restart. Backend rate limiting is the primary defense.
 * This only provides UX feedback to prevent users from hammering buttons.
 */
export function createRateLimiter(maxAttempts: number, windowMs: number) {
  let attempts = 0;
  let resetTime = 0;
  return {
    canAttempt(): boolean {
      const now = Date.now();
      if (now > resetTime) { attempts = 0; resetTime = now + windowMs; }
      return attempts < maxAttempts;
    },
    recordAttempt() { attempts++; },
    remainingMs(): number {
      return Math.max(0, resetTime - Date.now());
    },
  };
}
