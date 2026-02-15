/**
 * Returns a time-based greeting, optionally personalized with a display name.
 * Morning: hour < 12 | Afternoon: 12 ≤ hour < 17 | Evening: hour ≥ 17
 */
export function getGreeting(displayName?: string | null, hour?: number): string {
  const h = hour ?? new Date().getHours();

  let greeting: string;
  if (h < 12) {
    greeting = 'Good morning';
  } else if (h < 17) {
    greeting = 'Good afternoon';
  } else {
    greeting = 'Good evening';
  }

  if (displayName && displayName.length > 0) {
    return `${greeting}, ${displayName}`;
  }

  return greeting;
}
