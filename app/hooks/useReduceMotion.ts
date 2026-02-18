import { useReducedMotion } from 'react-native-reanimated';

/**
 * Thin wrapper around Reanimated's useReducedMotion hook.
 * Returns true when the OS reduce-motion setting is enabled.
 * Treats undefined as false (animations enabled) — failing open is the safe default.
 */
export function useReduceMotion(): boolean {
  const reduceMotion = useReducedMotion() ?? false;
  return reduceMotion;
}
