import * as fc from 'fast-check';

// Feature: premium-ui-implementation, Property 2: ErrorBoundary catches render errors
// Validates: Requirements 4.1, 4.3

/**
 * Property-based tests for ErrorBoundary component.
 *
 * Strategy: Since the test environment is Node (no jsdom/React renderer), we
 * test the ErrorBoundary class component's lifecycle methods directly:
 *   - getDerivedStateFromError (static) — state transition on error
 *   - componentDidCatch — onError callback invocation
 *   - handleRetry — state reset mechanism
 *   - render — branching logic (fallback vs children)
 *
 * We mock React, react-native, react-native-safe-area-context, and sibling
 * imports so the class can be imported and instantiated in Node.
 */

// ── Mocks (must come before ErrorBoundary import) ────────────────────────────

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: {
    create: (styles: any) => styles,
  },
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  Platform: { OS: 'ios' },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'Animated.View' },
  useSharedValue: jest.fn((init: number) => ({ value: init })),
  useAnimatedStyle: jest.fn((factory: () => any) => factory()),
  useReducedMotion: jest.fn(() => false),
  withSpring: jest.fn((v: number) => v),
  withTiming: jest.fn((v: number) => v),
  withDelay: jest.fn((_d: number, v: any) => v),
  withRepeat: jest.fn((v: any) => v),
  cancelAnimation: jest.fn(),
  Easing: { out: jest.fn((fn: any) => fn), ease: 'ease' },
}));

jest.mock('../../hooks/usePressAnimation', () => ({
  usePressAnimation: () => ({
    animatedStyle: { transform: [{ scale: 1 }], opacity: 1 },
    onPressIn: jest.fn(),
    onPressOut: jest.fn(),
  }),
}));

jest.mock('../../hooks/useHoverState', () => ({
  useHoverState: () => ({
    isHovered: false,
    hoverProps: {},
  }),
}));

jest.mock('../../hooks/useReduceMotion', () => ({
  useReduceMotion: jest.fn(() => false),
}));

jest.mock('../../theme/tokens', () => ({
  colors: {
    bg: { base: '#0A0E13', surface: '#12171F', overlay: 'rgba(0,0,0,0.6)' },
    text: { primary: '#FFFFFF', secondary: '#94A3B8', muted: '#7B8DA1' },
    accent: { primary: '#06B6D4' },
    semantic: {
      negative: '#EF4444',
      negativeSubtle: 'rgba(239,68,68,0.12)',
      positive: '#22C55E',
    },
    border: { default: 'rgba(255,255,255,0.08)', hover: 'rgba(255,255,255,0.12)' },
  },
  spacing: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24 },
  typography: {
    size: { xs: 12, sm: 13, base: 14, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 32 },
    weight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
    numeric: { fontVariant: ['tabular-nums', 'lining-nums'] },
  },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  shadows: { md: {} },
  opacityScale: { disabled: 0.4 },
  letterSpacing: { tight: -0.5, normal: 0, wide: 0.5 },
}));

// ── Import after mocks ──────────────────────────────────────────────────────
import { ErrorBoundary } from '../../components/common/ErrorBoundary';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates an ErrorBoundary instance with the given props.
 * Patches setState to apply state synchronously (since the component
 * is not mounted in a React tree, the real setState is a no-op).
 */
function createBoundaryInstance(props: {
  fallback?: (error: Error, retry: () => void) => any;
  onError?: (error: Error, errorInfo: any) => void;
}) {
  const instance = new (ErrorBoundary as any)({
    children: 'child-content',
    ...props,
  });
  // Patch setState to apply synchronously (mirrors React's behavior for testing)
  instance.setState = (updater: any) => {
    const newState = typeof updater === 'function' ? updater(instance.state) : updater;
    instance.state = { ...instance.state, ...newState };
  };
  return instance;
}

/**
 * Simulates an error being caught by the ErrorBoundary lifecycle.
 * Applies getDerivedStateFromError to get new state, then sets it on the instance.
 */
function simulateError(instance: any, error: Error) {
  const newState = (ErrorBoundary as any).getDerivedStateFromError(error);
  instance.state = { ...instance.state, ...newState };
}

// ── Property Tests ───────────────────────────────────────────────────────────

describe('Property 2: ErrorBoundary catches render errors and provides retry', () => {

  // 3.3.2 — For any error thrown by a child, ErrorBoundary catches it and renders fallback
  test('getDerivedStateFromError sets hasError=true and captures error for any error message', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (errorMessage) => {
          const error = new Error(errorMessage);
          const newState = (ErrorBoundary as any).getDerivedStateFromError(error);

          // ErrorBoundary must transition to error state
          expect(newState.hasError).toBe(true);
          expect(newState.error).toBe(error);
          expect(newState.error.message).toBe(errorMessage);
        },
      ),
      { numRuns: 100 },
    );
  });

  // 3.3.2 — Render method returns fallback (not children) when in error state
  test('render returns fallback content (not children) when hasError is true for any error', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (errorMessage) => {
          const instance = createBoundaryInstance({});
          const error = new Error(errorMessage);
          simulateError(instance, error);

          const rendered = instance.render();

          // When in error state without custom fallback, render returns the default
          // fallback UI (a SafeAreaView tree), NOT the children
          expect(rendered).not.toBe('child-content');
          expect(instance.state.hasError).toBe(true);
          expect(instance.state.error.message).toBe(errorMessage);
        },
      ),
      { numRuns: 100 },
    );
  });

  // 3.3.3 — After retry (state reset), if child no longer throws, normal UI renders
  test('handleRetry resets error state so children render again for any prior error', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (errorMessage) => {
          const instance = createBoundaryInstance({});
          const error = new Error(errorMessage);

          // Simulate error
          simulateError(instance, error);
          expect(instance.state.hasError).toBe(true);

          // Trigger retry — calls handleRetry which resets state
          // Access the private method via the instance
          instance.handleRetry();

          // State must be reset
          expect(instance.state.hasError).toBe(false);
          expect(instance.state.error).toBeNull();

          // render() should now return children (not fallback)
          const rendered = instance.render();
          expect(rendered).toBe('child-content');
        },
      ),
      { numRuns: 100 },
    );
  });

  // 3.3.4 — Custom fallback render prop receives correct error and working retry
  test('custom fallback receives the exact error object and a callable retry function', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.boolean(),
        (errorMessage, useCustomFallback) => {
          const error = new Error(errorMessage);
          let receivedError: Error | null = null;
          let receivedRetry: (() => void) | null = null;

          const customFallback = (err: Error, retry: () => void) => {
            receivedError = err;
            receivedRetry = retry;
            return 'custom-fallback-ui';
          };

          const instance = createBoundaryInstance({
            fallback: useCustomFallback ? customFallback : undefined,
          });

          simulateError(instance, error);
          const rendered = instance.render();

          if (useCustomFallback) {
            // Custom fallback must receive the exact error object
            expect(receivedError).toBe(error);
            expect(receivedError!.message).toBe(errorMessage);
            expect(rendered).toBe('custom-fallback-ui');

            // Retry function must work — resets state
            expect(typeof receivedRetry).toBe('function');
            receivedRetry!();
            expect(instance.state.hasError).toBe(false);
            expect(instance.state.error).toBeNull();

            // After retry, render returns children
            const afterRetry = instance.render();
            expect(afterRetry).toBe('child-content');
          } else {
            // Without custom fallback, default fallback renders (not children)
            expect(rendered).not.toBe('child-content');
            expect(receivedError).toBeNull(); // custom fallback was never called
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // 3.3.5 — onError callback is invoked with (error, errorInfo)
  test('componentDidCatch invokes onError callback with (error, errorInfo) for any error', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.boolean(),
        (errorMessage, hasOnError) => {
          const error = new Error(errorMessage);
          const mockErrorInfo = { componentStack: '\n    at ThrowingChild\n    at ErrorBoundary' };
          let callbackError: Error | null = null;
          let callbackInfo: any = null;
          let callbackInvoked = false;

          const onError = (err: Error, info: any) => {
            callbackInvoked = true;
            callbackError = err;
            callbackInfo = info;
          };

          const instance = createBoundaryInstance({
            onError: hasOnError ? onError : undefined,
          });

          // Suppress console.error from componentDidCatch
          const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

          instance.componentDidCatch(error, mockErrorInfo);

          consoleSpy.mockRestore();

          if (hasOnError) {
            expect(callbackInvoked).toBe(true);
            expect(callbackError).toBe(error);
            expect(callbackError!.message).toBe(errorMessage);
            expect(callbackInfo).toBe(mockErrorInfo);
          } else {
            // Without onError prop, callback is not invoked (no crash)
            expect(callbackInvoked).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // 3.3.6 — Combined property using fc.string() for messages and fc.boolean() for custom fallback
  test('full lifecycle: error → fallback → retry → children, for any error message and fallback config', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.boolean(),
        (errorMessage, hasCustomFallback) => {
          const error = new Error(errorMessage);
          let retryFn: (() => void) | null = null;

          const customFallback = (err: Error, retry: () => void) => {
            retryFn = retry;
            return `fallback:${err.message}`;
          };

          const instance = createBoundaryInstance({
            fallback: hasCustomFallback ? customFallback : undefined,
          });

          // Phase 1: Before error — children render
          expect(instance.render()).toBe('child-content');
          expect(instance.state.hasError).toBe(false);

          // Phase 2: Error occurs — fallback renders
          simulateError(instance, error);
          const fallbackRender = instance.render();
          expect(instance.state.hasError).toBe(true);
          expect(fallbackRender).not.toBe('child-content');

          if (hasCustomFallback) {
            expect(fallbackRender).toBe(`fallback:${errorMessage}`);
            expect(retryFn).not.toBeNull();
          }

          // Phase 3: Retry — children render again
          instance.handleRetry();
          expect(instance.state.hasError).toBe(false);
          expect(instance.state.error).toBeNull();
          expect(instance.render()).toBe('child-content');
        },
      ),
      { numRuns: 100 },
    );
  });
});
