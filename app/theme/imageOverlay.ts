/**
 * Theme-aware image overlay backgrounds.
 *
 * Provides semi-transparent backgrounds for text overlaid on images,
 * ensuring readability in both light and dark themes.
 */

export function getImageOverlayBg(theme: 'dark' | 'light'): string {
  return theme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)';
}

export function getImageOverlayBgSubtle(theme: 'dark' | 'light'): string {
  return theme === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)';
}
