import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { Platform, Alert, View, Text, ActivityIndicator } from 'react-native';
import { colors } from './theme/tokens';
import { BottomTabNavigator } from './navigation/BottomTabNavigator';
import { LoginScreen, initTokenProvider } from './screens/auth/LoginScreen';
import { RegisterScreen } from './screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from './screens/auth/ForgotPasswordScreen';
// import { OnboardingScreen } from './screens/onboarding/OnboardingScreen';
import { OnboardingWizard } from './screens/onboarding/OnboardingWizard';
import { initAnalytics } from './services/analytics';
import { useStore } from './store';
import { useActiveWorkoutStore } from './store/activeWorkoutSlice';
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

const navTheme = {
  dark: true as const,
  colors: {
    primary: colors.accent.primary,
    background: colors.bg.base,
    card: colors.bg.surface,
    text: colors.text.primary,
    border: colors.border.subtle,
    notification: colors.semantic.negative,
  },
};

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
  const setOnboardingSkipped = useStore((s) => s.setOnboardingSkipped);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initTokenProvider(clearAuth);
    initAnalytics(process.env.EXPO_PUBLIC_POSTHOG_KEY);
    restoreSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restoreSession = async () => {
    try {
      const accessToken = Platform.OS === 'web'
        ? localStorage.getItem('hos_access_token')
        : await SecureStore.getItemAsync('hos_access_token');
      const refreshToken = Platform.OS === 'web'
        ? localStorage.getItem('hos_refresh_token')
        : await SecureStore.getItemAsync('hos_refresh_token');
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
    setOnboardingSkipped(false);
  };

  const handleOnboardingSkip = () => {
    setOnboardingSkipped(true);
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
            { text: 'Resume', style: 'default' },
          ],
        );
      }
    };

    // Small delay to allow AsyncStorage rehydration
    const timer = setTimeout(checkActiveWorkout, 500);
    return () => clearTimeout(timer);
  }, [ready, isAuthenticated]);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: colors.bg.base, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.text.primary, fontSize: 28, fontWeight: '700' }}>HypertrophyOS</Text>
          <ActivityIndicator size="large" color={colors.accent.primary} style={{ marginTop: 24 }} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        <ErrorBoundary onError={(error, errorInfo) => {
          console.error('[ErrorBoundary:Root]', error.message);
          console.error('[ErrorBoundary:Root] Stack:', error.stack);
          console.error('[ErrorBoundary:Root] Component:', errorInfo.componentStack);
        }}>
          {isAuthenticated ? (
            needsOnboarding ? (
              <OnboardingWizard
                onComplete={handleOnboardingComplete}
                onSkip={handleOnboardingSkip}
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
  );
}
