import * as fc from 'fast-check';

// Feature: premium-ui-implementation, Property 1: Reduce-motion hooks produce static output
// Validates: Requirements 7.1, 7.2, 7.4

/**
 * Property-based tests for reduce-motion behavior across all animation hooks.
 *
 * Strategy: We mock both react-native-reanimated AND React's own hooks so the
 * animation hooks can execute synchronously in a Node/Jest environment without
 * a React renderer. The mocks simulate shared values, animated styles, and
 * React primitives (useCallback, useRef, useEffect) while letting the hooks'
 * reduce-motion branching run for real.
 *
 * Property 1 (reduceMotion=true):
 *   For every animation hook and any valid input, the returned output is
 *   static (final state, no animation).
 *
 * Property 2 (reduceMotion=false):
 *   For every animation hook and any valid input, the returned output uses
 *   animated values (withTiming/withSpring called, not snapped).
 */

// ── Mutable flag controlling reduce-motion ───────────────────────────────────
let _mockReduceMotion = false;

// Track animation API calls to verify animated vs static paths
let _withTimingCalls = 0;
let _withSpringCalls = 0;
let _withRepeatCalls = 0;
let _cancelAnimationCalls = 0;
let _effectCallbacks: Array<() => void> = [];

function resetAnimationTracking() {
  _withTimingCalls = 0;
  _withSpringCalls = 0;
  _withRepeatCalls = 0;
  _cancelAnimationCalls = 0;
  _effectCallbacks = [];
}

function flushEffects() {
  _effectCallbacks.forEach((cb) => cb());
  _effectCallbacks = [];
}

// ── React mock (must come before all imports) ────────────────────────────────
jest.mock('react', () => {
  const actualReact = jest.requireActual('react');
  return {
    ...actualReact,
    useCallback: jest.fn((fn: any) => fn),
    useRef: jest.fn((initial: any) => ({ current: initial })),
    useEffect: jest.fn((fn: () => void) => {
      _effectCallbacks.push(fn);
    }),
    useState: jest.fn((initial: any) => [initial, jest.fn()]),
  };
});


// ── Reanimated mock ──────────────────────────────────────────────────────────
jest.mock('react-native-reanimated', () => {
  const createSharedValue = (initial: number) => ({ value: initial });

  return {
    __esModule: true,
    default: { View: 'Animated.View' },
    useSharedValue: jest.fn((init: number) => createSharedValue(init)),
    useAnimatedStyle: jest.fn((factory: () => any) => factory()),
    useReducedMotion: jest.fn(() => _mockReduceMotion),
    withSpring: jest.fn((toValue: number, _config?: any) => {
      _withSpringCalls++;
      return toValue;
    }),
    withTiming: jest.fn((toValue: number, _config?: any) => {
      _withTimingCalls++;
      return toValue;
    }),
    withDelay: jest.fn((_delay: number, value: any) => value),
    withRepeat: jest.fn((value: any) => {
      _withRepeatCalls++;
      return value;
    }),
    cancelAnimation: jest.fn(() => {
      _cancelAnimationCalls++;
    }),
    Easing: {
      out: jest.fn((fn: any) => fn),
      ease: 'ease',
    },
  };
});

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AccessibilityInfo: { isReduceMotionEnabled: jest.fn(() => Promise.resolve(false)) },
}));

jest.mock('../../hooks/useReduceMotion', () => ({
  useReduceMotion: jest.fn(() => _mockReduceMotion),
}));

jest.mock('../../theme/tokens', () => ({
  springs: {
    gentle: { damping: 20, stiffness: 200, mass: 0.5 },
    snappy: { damping: 15, stiffness: 400, mass: 0.3 },
    bouncy: { damping: 12, stiffness: 200 },
    banner: { damping: 12, stiffness: 200 },
  },
  motion: {
    duration: {
      instant: 50,
      fast: 150,
      normal: 300,
      slow: 500,
      pulse: 800,
    },
  },
}));

// ── Hook imports (after mocks) ───────────────────────────────────────────────
import { usePressAnimation } from '../../hooks/usePressAnimation';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';
import { useCountingValue } from '../../hooks/useCountingValue';
import { useSkeletonPulse } from '../../hooks/useSkeletonPulse';

// ── Helpers ──────────────────────────────────────────────────────────────────
function setReduceMotion(value: boolean) {
  _mockReduceMotion = value;
  const { useReduceMotion } = require('../../hooks/useReduceMotion');
  (useReduceMotion as jest.Mock).mockReturnValue(value);
  const reanimated = require('react-native-reanimated');
  (reanimated.useReducedMotion as jest.Mock).mockReturnValue(value);
}


// ── Property 1: Reduce-motion TRUE → static output ──────────────────────────

describe('Property 1: Reduce-motion hooks produce static output', () => {
  beforeEach(() => {
    setReduceMotion(true);
    resetAnimationTracking();
  });

  // 2.2.2 — usePressAnimation: style has scale: 1, opacity: 1
  test('usePressAnimation returns static style (scale:1, opacity:1) for any press state when reduceMotion=true', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // whether onPressIn is called
        fc.boolean(), // whether onPressOut is called
        (pressIn, pressOut) => {
          resetAnimationTracking();
          const { animatedStyle, onPressIn, onPressOut } = usePressAnimation();

          // Simulate press interactions
          if (pressIn) onPressIn();
          if (pressOut) onPressOut();

          // Style must remain static regardless of press state
          expect(animatedStyle).toEqual(
            expect.objectContaining({
              transform: [{ scale: 1 }],
              opacity: 1,
            }),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  // 2.2.2 — useStaggeredEntrance: style has opacity: 1, translateY: 0 for any index
  test('useStaggeredEntrance returns static style (opacity:1, translateY:0) for any index when reduceMotion=true', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (index) => {
          resetAnimationTracking();
          const style = useStaggeredEntrance(index);

          expect(style).toEqual(
            expect.objectContaining({
              opacity: 1,
              transform: [{ translateY: 0 }],
            }),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  // 2.2.2 — useCountingValue: shared value equals target immediately
  test('useCountingValue snaps to target immediately for any numeric target when reduceMotion=true', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true }),
        (target) => {
          resetAnimationTracking();
          const sharedValue = useCountingValue(target);

          // The useEffect runs the reduce-motion snap path
          flushEffects();

          // Shared value must equal target immediately (no animation)
          expect(sharedValue.value).toBe(target);
        },
      ),
      { numRuns: 100 },
    );
  });

  // 2.2.2 — useSkeletonPulse: static opacity 0.5
  test('useSkeletonPulse returns static opacity 0.5 when reduceMotion=true', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          resetAnimationTracking();
          const style = useSkeletonPulse();
          expect(style).toEqual({ opacity: 0.5 });
        },
      ),
      { numRuns: 20 },
    );
  });

  // 2.2.4 — fc.constantFrom over hook names: unified property across all hooks
  test('for every animation hook, reduceMotion=true produces static final-state output', () => {
    const hookNames = [
      'usePressAnimation',
      'useStaggeredEntrance',
      'useCountingValue',
      'useSkeletonPulse',
    ] as const;

    fc.assert(
      fc.property(
        fc.constantFrom(...hookNames),
        fc.integer({ min: 0, max: 100 }),
        fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true }),
        (hookName, index, target) => {
          resetAnimationTracking();

          switch (hookName) {
            case 'usePressAnimation': {
              const result = usePressAnimation();
              expect(result.animatedStyle).toEqual(
                expect.objectContaining({ transform: [{ scale: 1 }], opacity: 1 }),
              );
              break;
            }
            case 'useStaggeredEntrance': {
              const style = useStaggeredEntrance(index);
              expect(style).toEqual(
                expect.objectContaining({ opacity: 1, transform: [{ translateY: 0 }] }),
              );
              break;
            }
            case 'useCountingValue': {
              const sv = useCountingValue(target);
              flushEffects();
              expect(sv.value).toBe(target);
              break;
            }
            case 'useSkeletonPulse': {
              const style = useSkeletonPulse();
              expect(style).toEqual({ opacity: 0.5 });
              break;
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ── Property 2: Reduce-motion FALSE → animated (non-static) output ──────────

describe('Property 2: Reduce-motion hooks produce animated output when motion enabled', () => {
  beforeEach(() => {
    setReduceMotion(false);
    resetAnimationTracking();
  });

  // 2.2.3 — usePressAnimation: onPressIn triggers withSpring (animation runs)
  test('usePressAnimation triggers spring animation on press when reduceMotion=false', () => {
    const reanimated = require('react-native-reanimated');

    const { animatedStyle, onPressIn } = usePressAnimation();

    // The animated style comes from useAnimatedStyle (our mock runs the factory)
    expect(animatedStyle).toHaveProperty('transform');
    expect(animatedStyle).toHaveProperty('opacity');

    // Pressing triggers withSpring calls
    (reanimated.withSpring as jest.Mock).mockClear();
    onPressIn();
    expect(reanimated.withSpring).toHaveBeenCalled();
  });

  // 2.2.3 — useStaggeredEntrance: returns animated style and triggers withTiming/withDelay
  test('useStaggeredEntrance triggers timed animation for any index when reduceMotion=false', () => {
    const reanimated = require('react-native-reanimated');

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (index) => {
          resetAnimationTracking();
          (reanimated.withTiming as jest.Mock).mockClear();

          const style = useStaggeredEntrance(index);
          flushEffects();

          // When motion is enabled, the hook returns the useAnimatedStyle result
          expect(style).toHaveProperty('opacity');
          expect(style).toHaveProperty('transform');

          // withTiming should have been called for the entrance animation
          expect(reanimated.withTiming).toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  // 2.2.3 — useCountingValue: withTiming is called (animation runs)
  test('useCountingValue triggers animation (withTiming called) for any target when reduceMotion=false', () => {
    const reanimated = require('react-native-reanimated');

    fc.assert(
      fc.property(
        fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true }),
        (target) => {
          resetAnimationTracking();
          (reanimated.withTiming as jest.Mock).mockClear();

          useCountingValue(target);
          flushEffects();

          // withTiming should have been called (animation, not snap)
          expect(reanimated.withTiming).toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  // 2.2.3 — useSkeletonPulse: withRepeat is called (pulsing animation runs)
  test('useSkeletonPulse triggers repeating animation when reduceMotion=false', () => {
    const reanimated = require('react-native-reanimated');
    resetAnimationTracking();
    (reanimated.withRepeat as jest.Mock).mockClear();

    useSkeletonPulse();
    flushEffects();

    expect(reanimated.withRepeat).toHaveBeenCalled();
  });
});
