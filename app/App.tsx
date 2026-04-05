import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Alert, View, Text, TextInput, ActivityIndicator } from 'react-native';
import { secureGet } from './utils/secureStorage';
import type { AuthScreenProps } from './types/navigation';
import { useThemeColors } from './hooks/useThemeColors';
import { useThemeStore } from './store/useThemeStore';
import { BottomTabNavigator } from './navigation/BottomTabNavigator';
import { LoginScreen, initTokenProvider } from './screens/auth/LoginScreen';
import { RegisterScreen } from './screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from './screens/auth/ForgotPasswordScreen';
import { EmailVerificationScreen } from './screens/auth/EmailVerificationScreen';
import { ResetPasswordScreen } from './screens/auth/ResetPasswordScreen';
// import { OnboardingScreen } from './screens/onboarding/OnboardingScreen';
import { OnboardingWizard } from './screens/onboarding/OnboardingWizard';
import { initAnalytics } from './services/analytics';
import { registerForPushNotifications, setupNotificationListeners, handleInitialNotification } from './services/notifications';
import { useStore } from './store';
import { useActiveWorkoutStore } from './store/activeWorkoutSlice';
import { isPremiumWorkoutLoggerEnabled } from './utils/featureFlags';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import api from './services/api';
import { configurePurchases } from './services/purchases';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient } from './services/queryClient';
import { mmkvPersister } from './services/mmkvStorage';
import { setupNetworkManager } from './services/networkManager';
import linking from './navigation/linking'; // Audit fix 4.2 — deep linking configuration

if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    release: Constants.expoConfig?.version ?? '1.0.0',
    tracesSampleRate: 0.1,
    environment: __DEV__ ? 'development' : 'production',
  });
}

// Global text scaling cap — allows 1.3x Dynamic Type while preventing layout breakage
// React 19 types removed defaultProps but it still works at runtime for RN core components
const TextWithDefaults = Text as unknown as { defaultProps?: Record<string, unknown> };
if (TextWithDefaults.defaultProps == null) TextWithDefaults.defaultProps = {};
TextWithDefaults.defaultProps.maxFontSizeMultiplier = 1.3;
const TextInputWithDefaults = TextInput as unknown as { defaultProps?: Record<string, unknown> };
if (TextInputWithDefaults.defaultProps == null) TextInputWithDefaults.defaultProps = {};
TextInputWithDefaults.defaultProps.maxFontSizeMultiplier = 1.3;

const defaultHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
  Sentry.captureException(error, { extra: { isFatal } });
  defaultHandler(error, isFatal);
});

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email: string };
  EmailVerification: { email: string };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function AuthNavigator() {
  const setAuth = useStore((s) => s.setAuth);
  const setNeedsOnboarding = useStore((s) => s.setNeedsOnboarding);
  const setProfile = useStore((s) => s.setProfile);
  const setSubscription = useStore((s) => s.setSubscription);

  /** After email verification, read stored tokens and activate auth + onboarding. */
  const handleVerified = async () => {
    const accessToken = await secureGet('rw_access_token');
    const refreshToken = await secureGet('rw_refresh_token');
    if (!accessToken || !refreshToken) return;

    try {
      const { data } = await api.get('auth/me');
      setAuth(
        { id: data.id, email: data.email, role: data.role ?? 'user', emailVerified: data.email_verified },
        { accessToken, refreshToken, expiresIn: data.expires_in ?? 3600 },
      );
      setNeedsOnboarding(true);
    } catch {
      // Token invalid — user stays on auth screen
    }
  };

  /** After login, set auth then load profile + subscription + check onboarding. */
  const handleLoginSuccess = async (user: { id: string; email: string; emailVerified?: boolean }, tokens: { accessToken: string; refreshToken: string; expiresIn: number }) => {
    setAuth({ id: user.id, email: user.email, role: 'user', emailVerified: user.emailVerified }, tokens);

    // Load profile, subscription, and goals in parallel
    try {
      const [profileRes, subRes, goalsRes] = await Promise.allSettled([
        api.get('users/profile'),
        api.get('payments/status'),
        api.get('users/goals'),
      ]);
      if (profileRes.status === 'fulfilled' && profileRes.value.data) {
        setProfile(profileRes.value.data);
      }
      if (subRes.status === 'fulfilled' && subRes.value.data) {
        setSubscription(subRes.value.data);
      }
      // If no goals, user needs onboarding
      if (goalsRes.status === 'fulfilled') {
        const hasGoals = goalsRes.value.data != null && Object.keys(goalsRes.value.data).length > 0;
        setNeedsOnboarding(!hasGoals);
      } else {
        // Goals fetch failed — safe fallback: assume needs onboarding
        setNeedsOnboarding(true);
      }
    } catch {
      // Non-blocking — profile/subscription will load on next screen
      setNeedsOnboarding(true);
    }
  };

  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login">
        {({ navigation }: AuthScreenProps<'Login'>) => (
          <LoginScreen
            onNavigateRegister={() => navigation.navigate('Register')}
            onLoginSuccess={(user, tokens) => handleLoginSuccess(user, tokens)}
            onNavigateForgotPassword={() => navigation.navigate('ForgotPassword')}
          />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name="Register">
        {({ navigation }: AuthScreenProps<'Register'>) => (
          <RegisterScreen
            onNavigateLogin={() => navigation.goBack()}
            onRegisterSuccess={(email: string) => navigation.navigate('EmailVerification', { email })}
          />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name="ForgotPassword">
        {({ navigation }: AuthScreenProps<'ForgotPassword'>) => (
          <ForgotPasswordScreen
            onNavigateBack={() => navigation.goBack()}
            onNavigateResetPassword={(email: string) => navigation.navigate('ResetPassword', { email })}
          />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name="ResetPassword">
        {({ route, navigation }: AuthScreenProps<'ResetPassword'>) => (
          <ResetPasswordScreen
            email={route.params.email}
            onResetSuccess={() => navigation.navigate('Login')}
            onBack={() => navigation.goBack()}
          />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name="EmailVerification">
        {({ route, navigation }: AuthScreenProps<'EmailVerification'>) => (
          <EmailVerificationScreen
            email={route.params.email}
            onVerified={handleVerified}
            onBack={() => navigation.goBack()}
          />
        )}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

export default function App() {
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const needsOnboarding = useStore((s) => s.needsOnboarding);
  const setAuth = useStore((s) => s.setAuth);
  const clearAuth = useStore((s) => s.clearAuth);
  const setNeedsOnboarding = useStore((s) => s.setNeedsOnboarding);
  const setProfile = useStore((s) => s.setProfile);
  const setSubscription = useStore((s) => s.setSubscription);
  const [ready, setReady] = useState(false);
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const themeMode = useThemeStore((s) => s.theme);
  const themeColors = useThemeColors();

  const navTheme = {
    dark: themeMode === 'dark',
    colors: {
      primary: themeColors.accent.primary,
      background: themeColors.bg.base,
      card: themeColors.bg.surface,
      text: themeColors.text.primary,
      border: themeColors.border.subtle,
      notification: themeColors.semantic.negative,
    },
  };

  useEffect(() => {
    initTokenProvider(clearAuth);
    initAnalytics(process.env.EXPO_PUBLIC_POSTHOG_KEY);
    setupNetworkManager();
    restoreSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restoreSession = async () => {
    try {
      const accessToken = await secureGet('rw_access_token');
      const refreshToken = await secureGet('rw_refresh_token');
      if (accessToken && refreshToken) {
        // Validate the token by fetching the current user
        const { data } = await api.get('auth/me');
        setAuth(
          { id: data.id, email: data.email, role: data.role ?? 'user', emailVerified: data.email_verified },
          { accessToken, refreshToken, expiresIn: data.expires_in ?? 3600 },
        );

        // Check if user needs onboarding by fetching goals
        try {
          const goalsRes = await api.get('users/goals');
          const hasGoals = goalsRes.data != null && Object.keys(goalsRes.data).length > 0;
          setNeedsOnboarding(!hasGoals);
        } catch {
          // If goals fetch fails, assume onboarding not needed to avoid blocking
          setNeedsOnboarding(false);
        }

        // Load profile and subscription in parallel
        try {
          const [profileRes, subRes] = await Promise.allSettled([
            api.get('users/profile'),
            api.get('payments/status'),
          ]);
          if (profileRes.status === 'fulfilled' && profileRes.value.data) {
            setProfile(profileRes.value.data);
          }
          if (subRes.status === 'fulfilled' && subRes.value.data) {
            setSubscription(subRes.value.data);
          }
        } catch {
          // Non-blocking
        }
      }
    } catch {
      // Token invalid or expired — stay on auth screen
    } finally {
      setReady(true);
    }
  };

  const handleOnboardingComplete = () => {
    setNeedsOnboarding(false);
  };

  // ── Crash recovery: check for active workout on mount (Task 16.6) ──────
  useEffect(() => {
    if (!ready || !isAuthenticated) return;

    // Wait for Zustand rehydration from AsyncStorage
    const checkActiveWorkout = () => {
      const workoutState = useActiveWorkoutStore.getState();
      if (workoutState.isActive && workoutState.exercises.length > 0) {
        const elapsed = workoutState.startedAt
          ? Math.floor((Date.now() - new Date(workoutState.startedAt).getTime()) / 1000)
          : 0;
        const { formatDuration } = require('./utils/durationFormat');
        const durationStr = formatDuration(elapsed);
        Alert.alert(
          'Resume Workout?',
          `You have an unfinished workout with ${workoutState.exercises.length} exercise${workoutState.exercises.length > 1 ? 's' : ''} (${durationStr} elapsed).`,
          [
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => useActiveWorkoutStore.getState().discardWorkout(),
            },
            { text: 'Resume', style: 'default', onPress: () => {
              if (isPremiumWorkoutLoggerEnabled() && navigationRef.current) {
                navigationRef.current.navigate('Home', { screen: 'ActiveWorkout', params: { mode: 'new' } });
              }
            } },
          ],
        );
      }
    };

    // Small delay to allow AsyncStorage rehydration
    const timer = setTimeout(checkActiveWorkout, 500);
    return () => clearTimeout(timer);
  }, [ready, isAuthenticated]);

  // ── Push notifications: register token when authenticated ────────────────
  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    registerForPushNotifications().catch((err: unknown) =>
      console.warn('[App] Push registration failed:', String(err)),
    );
  }, [ready, isAuthenticated]);

  // ── RevenueCat: configure SDK when user is authenticated ───────────────
  const user = useStore((s) => s.user);
  useEffect(() => {
    if (!ready || !isAuthenticated || !user?.id) return;
    configurePurchases(user.id).catch((err: unknown) =>
      console.warn('[App] RevenueCat config failed:', String(err)),
    );
  }, [ready, isAuthenticated, user?.id]);

  // ── Push notifications: listeners + cold-start handler ─────────────────
  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    const nav = navigationRef.current
      ? { navigate: (screen: string, params?: unknown) => {
          const ref = navigationRef.current;
          if (ref) (ref as unknown as { navigate: (screen: string, params?: unknown) => void }).navigate(screen, params);
        }}
      : null;
    const cleanup = setupNotificationListeners(nav);
    handleInitialNotification(nav);
    return cleanup;
  }, [ready, isAuthenticated]);

  if (!ready) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View style={{ flex: 1, backgroundColor: themeColors.bg.base, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: themeColors.text.primary, fontSize: 28, fontWeight: '700' }}>Repwise</Text>
            <ActivityIndicator size="large" color={themeColors.accent.primary} style={{ marginTop: 24 }} />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister: mmkvPersister }}
          onSuccess={() => { queryClient.resumePausedMutations().then(() => {}); }}
        >
          <NavigationContainer ref={navigationRef} theme={navTheme} linking={linking}>
            <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
            <ErrorBoundary onError={(error, errorInfo) => {
              console.error('[ErrorBoundary:Root]', error.message);
              console.error('[ErrorBoundary:Root] Stack:', error.stack);
              console.error('[ErrorBoundary:Root] Component:', errorInfo.componentStack);
            }}>
              {isAuthenticated ? (
                needsOnboarding ? (
                  <OnboardingWizard
                    onComplete={handleOnboardingComplete}
                  />
                ) : (
                  <BottomTabNavigator />
                )
              ) : (
                <AuthNavigator />
              )}
            </ErrorBoundary>
          </NavigationContainer>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
