/**
 * Theme-aware shadow/elevation styles.
 *
 * Light mode: real shadows for depth.
 * Dark mode: subtle border glow (existing behavior).
 */

import { ViewStyle } from 'react-native';

type Elevation = 'sm' | 'md' | 'lg';

const lightShadows: Record<Elevation, ViewStyle> = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 8, elevation: 4 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
};

const darkShadows: Record<Elevation, ViewStyle> = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
};

export function getThemedShadow(elevation: Elevation, theme: 'dark' | 'light'): ViewStyle {
  return theme === 'dark' ? darkShadows[elevation] : lightShadows[elevation];
}
