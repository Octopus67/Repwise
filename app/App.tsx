import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SecureStore from 'expo-secure-store';
import { Platform, Alert, View, Text, ActivityIndicator } from 'react-native';
import { useThemeColors } from './hooks/useThemeColors';
import { useThemeStore } from './store/useThemeStore';
import { BottomTabNavigator } from './navigation/BottomTabNavigator';
import { LoginScreen, initTokenProvider } from './screens/auth/LoginScreen';
import { RegisterScreen } from './screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from './screens/auth/ForgotPasswordScreen';
// import { OnboardingScreen } from './screens/onboarding/OnboardingScreen';
import { OnboardingWizard } from './screens/onboarding/OnboardingWizard';
import { initAnalytics } from './services/analytics';
import { registerForPushNotifications, setupNotificationListeners, handleInitialNotification } from './services/notifications';
import { useStore } from './store';
import { useActiveWorkoutStore } from './store/activeWorkoutSlice';
import { isPremiumWorkoutLoggerEnabled } from './utils/featureFlags';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import * as Sentry from '@sentry/react-native';
import api from './services/api';

if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: __DEV__ ? 'development' : 'production',
  });
}

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

const AuthStack = createStackNavigator<AuthStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login">
        {({ navigation }: any) => (
          <LoginScreen
            onNavigateRegister={() => navigation.navigate('Register')}
            onLoginSuccess={() => {}}
            onNavigateForgotPassword={() => navigation.navigate('ForgotPassword')}
          />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name="Register">
        {({ navigation }: any) => (
          <RegisterScreen
            onNavigateLogin={() => navigation.goBack()}
            onRegisterSuccess={() => {}}
          />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name="ForgotPassword">
        {({ navigation }: any) => (
          <ForgotPasswordScreen
            onNavigateBack={() => navigation.goBack()}
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
    restoreSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restoreSession = async () => {
    try {
      const accessToken = Platform.OS === 'web'
        ? localStorage.getItem('rw_access_token')
        : await SecureStore.getItemAsync('rw_access_token');
      const refreshToken = Platform.OS === 'web'
        ? localStorage.getItem('rw_refresh_token')
        : await SecureStore.getItemAsync('rw_refresh_token');
      if (accessToken && refreshToken) {
        // Validate the token by fetching the current user
        const { data } = await api.get('auth/me');
        setAuth(
          { id: data.id, email: data.email, role: data.role ?? 'user' },
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
        const mins = Math.floor(elapsed / 60);
        Alert.alert(
          'Resume Workout?',
          `You have an unfinished workout with ${workoutState.exercises.length} exercise${workoutState.exercises.length > 1 ? 's' : ''} (${mins} min ago).`,
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
    registerForPushNotifications().catch((err) =>
      console.warn('[App] Push registration failed:', err),
    );
  }, [ready, isAuthenticated]);

  // ── Push notifications: listeners + cold-start handler ─────────────────
  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    const nav = navigationRef.current
      ? { navigate: (screen: string, params?: unknown) => {
          const ref = navigationRef.current;
          if (ref) (ref as { navigate: Function }).navigate(screen, params);
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
        <NavigationContainer ref={navigationRef} theme={navTheme}>
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
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
