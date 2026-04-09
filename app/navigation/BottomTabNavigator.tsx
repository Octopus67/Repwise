import React, { Suspense } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { typography, spacing } from '../theme/tokens';
import { triggerHaptic } from '../hooks/useHaptics';
import { haptic } from '../utils/haptics';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { useThemeColors, getThemeColors, ThemeColors } from '../hooks/useThemeColors';

// Eagerly loaded screens (tab roots + frequently navigated)
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { LogsScreen } from '../screens/logs/LogsScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { ExercisePickerScreen } from '../screens/exercise-picker/ExercisePickerScreen';
import { ActiveWorkoutScreen } from '../screens/training/ActiveWorkoutScreen';
import { WorkoutSummaryScreen } from '../screens/training/WorkoutSummaryScreen';
import { SessionDetailScreen } from '../screens/training/SessionDetailScreen';

// Lazily loaded screens (heavy / infrequently visited)
const AnalyticsScreen = React.lazy(() => import('../screens/analytics/AnalyticsScreen').then(m => ({ default: m.AnalyticsScreen })));
const LearnScreen = React.lazy(() => import('../screens/learn/LearnScreen').then(m => ({ default: m.LearnScreen })));
const ArticleDetailScreen = React.lazy(() => import('../screens/learn/ArticleDetailScreen').then(m => ({ default: m.ArticleDetailScreen })));
const MicronutrientDashboardScreen = React.lazy(() => import('../screens/nutrition/MicronutrientDashboardScreen').then(m => ({ default: m.MicronutrientDashboardScreen })));
const PRHistoryScreen = React.lazy(() => import('../screens/training/PRHistoryScreen').then(m => ({ default: m.PRHistoryScreen })));
const CoachingScreen = React.lazy(() => import('../screens/coaching/CoachingScreen').then(m => ({ default: m.CoachingScreen })));
const CommunityScreen = React.lazy(() => import('../screens/community/CommunityScreen').then(m => ({ default: m.CommunityScreen })));
const FeedScreen = React.lazy(() => import('../screens/social/FeedScreen').then(m => ({ default: m.FeedScreen })));
const LeaderboardScreen = React.lazy(() => import('../screens/social/LeaderboardScreen').then(m => ({ default: m.LeaderboardScreen })));
const DiscoverScreen = React.lazy(() => import('../screens/social/DiscoverScreen').then(m => ({ default: m.DiscoverScreen })));
const FounderStoryScreen = React.lazy(() => import('../screens/founder/FounderStoryScreen').then(m => ({ default: m.FounderStoryScreen })));
const NutritionReportScreen = React.lazy(() => import('../screens/nutrition/NutritionReportScreen').then(m => ({ default: m.NutritionReportScreen })));
const ExerciseHistoryScreen = React.lazy(() => import('../screens/training/ExerciseHistoryScreen').then(m => ({ default: m.ExerciseHistoryScreen })));
const HUExplainerScreen = React.lazy(() => import('../screens/analytics/HUExplainerScreen').then(m => ({ default: m.HUExplainerScreen })));
const WeeklyReportScreen = React.lazy(() => import('../screens/reports/WeeklyReportScreen').then(m => ({ default: m.WeeklyReportScreen })));
const MonthlyReportScreen = React.lazy(() => import('../screens/reports/MonthlyReportScreen').then(m => ({ default: m.MonthlyReportScreen })));
const YearInReviewScreen = React.lazy(() => import('../screens/reports/YearInReviewScreen').then(m => ({ default: m.YearInReviewScreen })));
const ProgressPhotosScreen = React.lazy(() => import('../screens/profile/ProgressPhotosScreen').then(m => ({ default: m.ProgressPhotosScreen })));
const MeasurementsScreen = React.lazy(() => import('../screens/measurements/MeasurementsScreen').then(m => ({ default: m.MeasurementsScreen })));
const NotificationSettingsScreen = React.lazy(() => import('../screens/settings/NotificationSettingsScreen').then(m => ({ default: m.NotificationSettingsScreen })));
const MealPlanScreen = React.lazy(() => import('../screens/meal-prep/MealPlanScreen').then(m => ({ default: m.MealPlanScreen })));
const ShoppingListView = React.lazy(() => import('../screens/meal-prep/ShoppingListView').then(m => ({ default: m.ShoppingListView })));
const PrepSundayFlow = React.lazy(() => import('../screens/meal-prep/PrepSundayFlow').then(m => ({ default: m.PrepSundayFlow })));
const DataExportScreen = React.lazy(() => import('../screens/profile/DataExportScreen').then(m => ({ default: m.DataExportScreen })));
const ImportDataScreen = React.lazy(() => import('../screens/settings/ImportDataScreen').then(m => ({ default: m.ImportDataScreen })));

function LazyFallback() {
  const c = getThemeColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg.base, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="small" color={c.accent.primary} />
    </View>
  );
}

/** Wrap a lazy component for use with React Navigation's component prop */
function withSuspense<P extends object>(LazyComponent: React.LazyExoticComponent<React.ComponentType<P>>) {
  return function SuspenseWrapper(props: P) {
    return (
      <Suspense fallback={<LazyFallback />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

import type { ActiveWorkoutScreenParams } from '../types/training';

// ─── Param lists ─────────────────────────────────────────────────────────────

export type DashboardStackParamList = {
  DashboardHome: undefined;
  ExercisePicker: { target?: 'modal' | 'activeWorkout' | 'swapExercise'; currentExerciseLocalId?: string; muscleGroup?: string };
  ActiveWorkout: ActiveWorkoutScreenParams;
  WorkoutSummary: {
    summary: import('../utils/workoutSummary').WorkoutSummaryResult;
    duration: number;
    personalRecords: import('../types/training').PersonalRecordResponse[];
    exerciseBreakdown: Array<{
      exerciseName: string;
      setsCompleted: number;
      bestSet: { weight: string; reps: string } | null;
    }>;
    huByMuscle?: Record<string, number>;
    recommendations?: string[];
  };
  WeeklyReport: undefined;
  ArticleDetail: { articleId: string };
  Learn: undefined;
};

export type LogsStackParamList = {
  LogsHome: undefined;
  ExercisePicker: { target?: 'modal' | 'activeWorkout' | 'swapExercise'; currentExerciseLocalId?: string; muscleGroup?: string };
  ActiveWorkout: ActiveWorkoutScreenParams;
  WorkoutSummary: {
    summary: import('../utils/workoutSummary').WorkoutSummaryResult;
    duration: number;
    personalRecords: import('../types/training').PersonalRecordResponse[];
    exerciseBreakdown: Array<{
      exerciseName: string;
      setsCompleted: number;
      bestSet: { weight: string; reps: string } | null;
    }>;
    huByMuscle?: Record<string, number>;
    recommendations?: string[];
  };
  SessionDetail: { sessionId: string };
};

export type AnalyticsStackParamList = {
  AnalyticsHome: { initialTab?: 'nutrition' | 'training' | 'body' | 'volume' } | undefined;
  NutritionReport: undefined;
  MicronutrientDashboard: undefined;
  WeeklyReport: undefined;
  MonthlyReport: undefined;
  ExerciseHistory: { exerciseName: string };
  HUExplainer: undefined; // Audit fix 7.7 — typed navigation
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Learn: undefined;
  ArticleDetail: { articleId: string };
  Coaching: undefined;
  Community: undefined;
  Feed: undefined;
  Leaderboard: undefined;
  Discover: undefined;
  FounderStory: undefined;
  ProgressPhotos: undefined;
  Measurements: undefined;
  MealPlan: undefined;
  ShoppingList: { planId: string };
  PrepSunday: undefined;
  NotificationSettings: undefined;
  DataExport: undefined;
  PRHistory: undefined;
  YearInReview: undefined;
  ImportData: undefined;
};

export type BottomTabParamList = {
  Home: undefined;
  Log: undefined;
  Analytics: undefined;
  Profile: undefined;
};

// ─── Exported route names for testing ────────────────────────────────────────

export const TAB_NAMES: (keyof BottomTabParamList)[] = ['Home', 'Log', 'Analytics', 'Profile'];
export const PROFILE_STACK_ROUTES: (keyof ProfileStackParamList)[] = [
  'ProfileHome', 'Learn', 'ArticleDetail', 'Coaching', 'Community', 'Feed', 'Leaderboard', 'Discover', 'FounderStory', 'ProgressPhotos', 'Measurements', 'MealPlan', 'ShoppingList', 'PrepSunday', 'NotificationSettings', 'DataExport', 'PRHistory', 'YearInReview', 'ImportData',
];

// ─── Stack navigators ────────────────────────────────────────────────────────

const DashboardStack = createNativeStackNavigator<DashboardStackParamList>();
const LogsStack = createNativeStackNavigator<LogsStackParamList>();
const AnalyticsStack = createNativeStackNavigator<AnalyticsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

const stackScreenOptions = {
  headerShown: false,
  animation: 'slide_from_right',
} as const;

function DashboardStackScreen() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('[ErrorBoundary:Home]', error.message);
        console.error('[ErrorBoundary:Home] Stack:', error.stack);
        console.error('[ErrorBoundary:Home] Component:', errorInfo.componentStack);
      }}
      fallback={(error, retry) => (
        <View style={getStyles().errorFallback}>
          <Text style={getStyles().errorTitle}>Dashboard unavailable</Text>
          <Text style={getStyles().errorMessage}>{error.message}</Text>
          <TouchableOpacity style={getStyles().retryButton} onPress={retry}>
            <Text style={getStyles().retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}
    >
    <DashboardStack.Navigator screenOptions={stackScreenOptions}>
      <DashboardStack.Screen name="DashboardHome" component={DashboardScreen} />
      <DashboardStack.Screen name="ExercisePicker" component={ExercisePickerScreen} />
      <DashboardStack.Screen name="ActiveWorkout" component={ActiveWorkoutScreen} options={{ headerShown: false }} />
      <DashboardStack.Screen name="WorkoutSummary" component={WorkoutSummaryScreen} options={{ headerShown: false }} />
      <DashboardStack.Screen name="WeeklyReport" component={withSuspense(WeeklyReportScreen)} />
      <DashboardStack.Screen name="ArticleDetail">
        {({ route, navigation }: NativeStackScreenProps<DashboardStackParamList, 'ArticleDetail'>) => (
          <Suspense fallback={<LazyFallback />}>
            <ArticleDetailScreen
              articleId={route.params.articleId}
              onBack={() => navigation.goBack()}
              onSeeAll={() => navigation.navigate('Learn')}
            />
          </Suspense>
        )}
      </DashboardStack.Screen>
      <DashboardStack.Screen name="Learn" component={withSuspense(LearnScreen)} />
    </DashboardStack.Navigator>
    </ErrorBoundary>
  );
}

function LogsStackScreen() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('[ErrorBoundary:Log]', error.message);
        console.error('[ErrorBoundary:Log] Stack:', error.stack);
        console.error('[ErrorBoundary:Log] Component:', errorInfo.componentStack);
      }}
      fallback={(error, retry) => (
        <View style={getStyles().errorFallback}>
          <Text style={getStyles().errorTitle}>Logs unavailable</Text>
          <Text style={getStyles().errorMessage}>{error.message}</Text>
          <TouchableOpacity style={getStyles().retryButton} onPress={retry}>
            <Text style={getStyles().retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}
    >
    <LogsStack.Navigator screenOptions={stackScreenOptions}>
      <LogsStack.Screen name="LogsHome" component={LogsScreen} />
      <LogsStack.Screen name="ExercisePicker" component={ExercisePickerScreen} />
      <LogsStack.Screen name="ActiveWorkout" component={ActiveWorkoutScreen} options={{ headerShown: false }} />
      <LogsStack.Screen name="WorkoutSummary" component={WorkoutSummaryScreen} options={{ headerShown: false }} />
      <LogsStack.Screen name="SessionDetail" component={SessionDetailScreen} options={{ headerShown: false }} />
    </LogsStack.Navigator>
    </ErrorBoundary>
  );
}

function AnalyticsStackScreen() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('[ErrorBoundary:Analytics]', error.message);
        console.error('[ErrorBoundary:Analytics] Stack:', error.stack);
        console.error('[ErrorBoundary:Analytics] Component:', errorInfo.componentStack);
      }}
      fallback={(error, retry) => (
        <View style={getStyles().errorFallback}>
          <Text style={getStyles().errorTitle}>Analytics unavailable</Text>
          <Text style={getStyles().errorMessage}>{error.message}</Text>
          <TouchableOpacity style={getStyles().retryButton} onPress={retry}>
            <Text style={getStyles().retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}
    >
    <AnalyticsStack.Navigator screenOptions={stackScreenOptions}>
      <AnalyticsStack.Screen name="AnalyticsHome" component={withSuspense(AnalyticsScreen)} />
      <AnalyticsStack.Screen name="NutritionReport" component={withSuspense(NutritionReportScreen)} />
      <AnalyticsStack.Screen name="MicronutrientDashboard" component={withSuspense(MicronutrientDashboardScreen)} />
      <AnalyticsStack.Screen name="WeeklyReport" component={withSuspense(WeeklyReportScreen)} />
      <AnalyticsStack.Screen name="MonthlyReport" component={withSuspense(MonthlyReportScreen)} />
      <AnalyticsStack.Screen name="ExerciseHistory" component={withSuspense(ExerciseHistoryScreen)} options={{ headerShown: false }} />
      <AnalyticsStack.Screen name="HUExplainer" component={withSuspense(HUExplainerScreen)} options={{ title: 'Hypertrophy Units' }} />
    </AnalyticsStack.Navigator>
    </ErrorBoundary>
  );
}

function ProfileStackScreen() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('[ErrorBoundary:Profile]', error.message);
        console.error('[ErrorBoundary:Profile] Stack:', error.stack);
        console.error('[ErrorBoundary:Profile] Component:', errorInfo.componentStack);
      }}
      fallback={(error, retry) => (
        <View style={getStyles().errorFallback}>
          <Text style={getStyles().errorTitle}>Profile unavailable</Text>
          <Text style={getStyles().errorMessage}>{error.message}</Text>
          <TouchableOpacity style={getStyles().retryButton} onPress={retry}>
            <Text style={getStyles().retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}
    >
    <ProfileStack.Navigator screenOptions={stackScreenOptions}>
      <ProfileStack.Screen name="ProfileHome" component={ProfileScreen} />
      <ProfileStack.Screen name="Learn" component={withSuspense(LearnScreen)} />
      <ProfileStack.Screen name="ArticleDetail">
        {({ route, navigation }: NativeStackScreenProps<ProfileStackParamList, 'ArticleDetail'>) => (
          <Suspense fallback={<LazyFallback />}>
            <ArticleDetailScreen
              articleId={route.params.articleId}
              onBack={() => navigation.goBack()}
              onSeeAll={() => navigation.navigate('Learn')}
            />
          </Suspense>
        )}
      </ProfileStack.Screen>
      <ProfileStack.Screen name="Coaching" component={withSuspense(CoachingScreen)} />
      <ProfileStack.Screen name="Community" component={withSuspense(CommunityScreen)} />
      <ProfileStack.Screen name="Feed" component={withSuspense(FeedScreen)} />
      <ProfileStack.Screen name="Leaderboard" component={withSuspense(LeaderboardScreen)} />
      <ProfileStack.Screen name="Discover" component={withSuspense(DiscoverScreen)} />
      <ProfileStack.Screen name="FounderStory" component={withSuspense(FounderStoryScreen)} />

      <ProfileStack.Screen name="ProgressPhotos" component={withSuspense(ProgressPhotosScreen)} />
      <ProfileStack.Screen name="Measurements" component={withSuspense(MeasurementsScreen)} />
      <ProfileStack.Screen name="MealPlan" component={withSuspense(MealPlanScreen)} />
      <ProfileStack.Screen name="ShoppingList" component={withSuspense(ShoppingListView)} />
      <ProfileStack.Screen name="PrepSunday" component={withSuspense(PrepSundayFlow)} />
      <ProfileStack.Screen name="NotificationSettings" component={withSuspense(NotificationSettingsScreen)} />
      <ProfileStack.Screen name="DataExport" component={withSuspense(DataExportScreen)} />
      <ProfileStack.Screen name="PRHistory" component={withSuspense(PRHistoryScreen)} />
      <ProfileStack.Screen name="YearInReview" component={withSuspense(YearInReviewScreen)} />
      <ProfileStack.Screen name="ImportData" component={withSuspense(ImportDataScreen)} />
    </ProfileStack.Navigator>
    </ErrorBoundary>
  );
}

// ─── SVG Tab Icons ───────────────────────────────────────────────────────────

function TabBadge() {
  return (
    <View style={{ position: 'absolute', top: -2, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: 'red' }} />
  );
}

function TabSvgIcon({ name, color, showBadge }: { name: keyof BottomTabParamList; color: string; showBadge?: boolean }) {
  const size = 22;
  const sw = 1.8;
  switch (name) {
    case 'Home':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="3" y="12" width="4" height="9" rx="1" stroke={color} strokeWidth={sw} />
          <Rect x="10" y="6" width="4" height="15" rx="1" stroke={color} strokeWidth={sw} />
          <Rect x="17" y="3" width="4" height="18" rx="1" stroke={color} strokeWidth={sw} />
        </Svg>
      );
    case 'Log':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="4" y="2" width="16" height="20" rx="2" stroke={color} strokeWidth={sw} />
          <Line x1="8" y1="8" x2="16" y2="8" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="8" y1="12" x2="16" y2="12" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="8" y1="16" x2="13" y2="16" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'Analytics':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M3 20L9 13l4 4 8-10" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx="9" cy="13" r="1.5" fill={color} />
          <Circle cx="13" cy="17" r="1.5" fill={color} />
          <Circle cx="21" cy="7" r="1.5" fill={color} />
        </Svg>
      );
    case 'Profile':
      return (
        <View>
          <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={sw} />
            <Path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          </Svg>
          {showBadge && <TabBadge />}
        </View>
      );
    default:
      return null;
  }
}

// ─── Bottom tabs ─────────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<BottomTabParamList>();

export function BottomTabNavigator() {
  const themeColors = useThemeColors();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: [getStyles().tabBar, { backgroundColor: themeColors.bg.surface, borderTopColor: themeColors.border.subtle }],
        tabBarActiveTintColor: themeColors.accent.primary,
        tabBarInactiveTintColor: themeColors.text.muted,
        tabBarLabelStyle: getStyles().tabLabel,
        tabBarIcon: ({ focused }) => (
          <View style={[getStyles().iconWrap, focused && { backgroundColor: themeColors.accent.primaryMuted }]}>
            <TabSvgIcon
              name={route.name as keyof BottomTabParamList}
              color={focused ? themeColors.accent.primary : themeColors.text.muted}
              showBadge={route.name === 'Profile'}
            />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Home" component={DashboardStackScreen} options={{ tabBarTestID: 'tab-home' }} listeners={{ tabPress: () => haptic.selection() }} />
      <Tab.Screen name="Log" component={LogsStackScreen} options={{ tabBarTestID: 'tab-log' }} listeners={{ tabPress: () => haptic.selection() }} />
      <Tab.Screen name="Analytics" component={AnalyticsStackScreen} options={{ tabBarTestID: 'tab-analytics' }} listeners={{ tabPress: () => haptic.selection() }} />
      <Tab.Screen name="Profile" component={ProfileStackScreen} options={{ tabBarTestID: 'tab-profile' }} listeners={{ tabPress: () => haptic.selection() }} />
    </Tab.Navigator>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

/** Lazy styles for module-level helpers */
function getStyles() { return getThemedStyles(getThemeColors()); }

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  tabBar: {
    backgroundColor: c.bg.surface,
    borderTopColor: 'rgba(255,255,255,0.06)',
    borderTopWidth: 1,
    height: 64,
    paddingBottom: spacing[2],
    paddingTop: spacing[1],
  },
  tabLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    marginTop: spacing[1],
  },
  iconWrap: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  iconWrapActive: {
    backgroundColor: c.accent.primaryMuted,
  },
  errorFallback: {
    flex: 1,
    backgroundColor: c.bg.base,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  errorTitle: {
    color: c.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[2],
  },
  errorMessage: {
    color: c.text.muted,
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  retryButton: {
    backgroundColor: c.accent.primary,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: 8,
  },
  retryText: {
    color: c.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
});
