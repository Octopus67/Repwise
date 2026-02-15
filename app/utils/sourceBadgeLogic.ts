/**
 * Pure logic for SourceBadge — no React/RN dependencies.
 * Extracted for testability in a Node environment.
 */

export type FoodSource = 'usda' | 'verified' | 'community' | 'custom';

const GREEN = '#22C55E';
const GRAY = '#9CA3AF';

export function getSourceBadgeColor(source: FoodSource): string {
  return source === 'usda' || source === 'verified' ? GREEN : GRAY;
}

export function getSourceBadgeIcon(
  source: FoodSource,
): 'checkmark-circle' | 'ellipse-outline' {
  return source === 'usda' || source === 'verified'
    ? 'checkmark-circle'
    : 'ellipse-outline';
}

const TOOLTIP_TEXT: Record<FoodSource, string> = {
  usda: 'USDA verified — lab-tested nutritional data',
  verified: 'Verified — curated nutritional data',
  community: 'Community submitted — may vary in accuracy',
  custom: 'Custom entry — your own data',
};

export function getSourceTooltip(source: FoodSource): string {
  return TOOLTIP_TEXT[source];
}
