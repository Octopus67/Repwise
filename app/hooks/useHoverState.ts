import { useState, useMemo } from 'react';
import { Platform } from 'react-native';

/**
 * Hook that provides hover state tracking for web.
 * Returns `isHovered` boolean and `hoverProps` to spread onto a View/Touchable.
 * On native, `hoverProps` is an empty object (no-op).
 */
export function useHoverState() {
  const [isHovered, setIsHovered] = useState(false);

  const hoverProps = useMemo(() => {
    if (Platform.OS !== 'web') return {};
    return {
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => setIsHovered(false),
    };
  }, []);

  return { isHovered, hoverProps };
}
