/**
 * useThemeColors — Returns the active color palette based on current theme.
 *
 * Usage: const c = useThemeColors();
 * Then use c.bg.base, c.text.primary, etc. instead of colors.xxx
 */

import { useMemo } from 'react';
import { colors as darkColors } from '../theme/tokens';
import { lightColors } from '../theme/lightColors';
import { useThemeStore } from '../store/useThemeStore';

export type ThemeColors = typeof darkColors;

export function useThemeColors(): ThemeColors {
  const theme = useThemeStore((s) => s.theme);
  return useMemo(
    () => (theme === 'dark' ? darkColors : (lightColors as unknown as ThemeColors)),
    [theme],
  );
}

/** Non-hook version for use outside React components (e.g. StyleSheet factories) */
export function getThemeColors(): ThemeColors {
  const theme = useThemeStore.getState().theme;
  return theme === 'dark' ? darkColors : (lightColors as unknown as ThemeColors);
}
