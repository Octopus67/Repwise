import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, StackCardInterpolationProps } from '@react-navigation/stack';
import { Animated, Easing, StyleSheet, View, Text } from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { colors, typography, spacing } from '../theme/tokens';

// Screen imports
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { LogsScreen } from '../screens/logs/LogsScreen';
import { AnalyticsScreen } from '../screens/analytics/AnalyticsScreen';
import { LearnScreen } from '../screens/learn/LearnScreen';
import { ArticleDetailScreen } from '../screens/learn/ArticleDetailScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { CoachingScreen } from '../screens/coaching/CoachingScreen';
import { CommunityScreen } from '../screens/community/CommunityScreen';
import { FounderStoryScreen } from '../screens/founder/FounderStoryScreen';
import { HealthReportsScreen } from '../screens/health/HealthReportsScreen';
import { ExercisePickerScreen } from '../screens/exercise-picker/ExercisePickerScreen';
import { ProgressPhotosScreen } from '../screens/profile/ProgressPhotosScreen';
import { NutritionReportScreen } from '../screens/nutrition/NutritionReportScreen';
import { MealPlanScreen } from '../screens/meal-prep/MealPlanScreen';
import { ShoppingListView } from '../screens/meal-prep/ShoppingListView';
import { PrepSundayFlow } from '../screens/meal-prep/PrepSundayFlow';
import { WeeklyReportScreen } from '../screens/reports/WeeklyReportScreen';
import { SessionDetailView } from '../screens/training/SessionDetailView';
import { ActiveWorkoutScreen } from '../screens/training/ActiveWorkoutScreen';
import type { ActiveWorkoutScreenParams } from '../types/training';

// ─── Param lists ─────────────────────────────────────────────────────────────

export type DashboardStackParamList = {
  DashboardHome: undefined;
  ExercisePicker: { target?: 'modal' | 'activeWorkout' };
  ActiveWorkout: ActiveWorkoutScreenParams;
  WeeklyReport: undefined;
  ArticleDetail: { articleId: string };
  Learn: undefined;
};

export type LogsStackParamList = {
  LogsHome: undefined;
  ExercisePicker: { target?: 'modal' | 'activeWorkout' };
  ActiveWorkout: ActiveWorkoutScreenParams;
  SessionDetail: { sessionId: string };
};

export type AnalyticsStackParamList = {
  AnalyticsHome: undefined;
  NutritionReport: undefined;
  WeeklyReport: undefined;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Learn: undefined;
  ArticleDetail: { articleId: string };
  Coaching: undefined;
  Community: undefined;
  FounderStory: undefined;
  HealthReports: undefined;
  ProgressPhotos: undefined;
  MealPlan: undefined;
  ShoppingList: { planId: string };
  PrepSunday: undefined;
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
  'ProfileHome', 'Learn', 'ArticleDetail', 'Coaching', 'Community', 'FounderStory', 'HealthReports', 'ProgressPhotos', 'MealPlan', 'ShoppingList', 'PrepSunday',
];

// ─── Custom card style interpolator ──────────────────────────────────────────

function slideFromRight({ current, layouts }: StackCardInterpolationProps) {
  return {
    cardStyle: {
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [0, 1],
            outputRange: [layouts.screen.width * 0.3, 0],
          }),
        },
      ],
      opacity: current.progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.95, 1],
      }),
    },
  };
}

const pushTransitionSpec = {
  animation: 'timing' as const,
  config: { duration: 250, easing: Easing.out(Easing.ease) },
};

const popTransitionSpec = {
  animation: 'timing' as const,
  config: { duration: 200, easing: Easing.inOut(Easing.ease) },
};

// ─── Placeholder screens (replaced in steps 15-16) ──────────────────────────

// ActiveWorkoutPlaceholder replaced by real ActiveWorkoutScreen

function SessionDetailPlaceholder() {
  // Replaced by real SessionDetailView — kept for reference only
  return null;
}

// ─── Stack navigators ────────────────────────────────────────────────────────

const DashboardStack = createStackNavigator<DashboardStackParamList>();
const LogsStack = createStackNavigator<LogsStackParamList>();
const AnalyticsStack = createStackNavigator<AnalyticsStackParamList>();
const ProfileStack = createStackNavigator<ProfileStackParamList>();

const stackScreenOptions = {
  headerShown: false,
  cardStyleInterpolator: slideFromRight,
  transitionSpec: {
    open: pushTransitionSpec,
    close: popTransitionSpec,
  },
} as const;

function DashboardStackScreen() {
  return (
    <DashboardStack.Navigator screenOptions={stackScreenOptions}>
      <DashboardStack.Screen name="DashboardHome" component={DashboardScreen} />
      <DashboardStack.Screen name="ExercisePicker" component={ExercisePickerScreen} />
      <DashboardStack.Screen name="ActiveWorkout" component={ActiveWorkoutScreen} options={{ headerShown: false }} />
      <DashboardStack.Screen name="WeeklyReport" component={WeeklyReportScreen} />
      <DashboardStack.Screen name="ArticleDetail">
        {({ route, navigation }: any) => (
          <ArticleDetailScreen
            articleId={route.params.articleId}
            onBack={() => navigation.goBack()}
          />
        )}
      </DashboardStack.Screen>
      <DashboardStack.Screen name="Learn" component={LearnScreen} />
    </DashboardStack.Navigator>
  );
}

function LogsStackScreen() {
  return (
    <LogsStack.Navigator screenOptions={stackScreenOptions}>
      <LogsStack.Screen name="LogsHome" component={LogsScreen} />
      <LogsStack.Screen name="ExercisePicker" component={ExercisePickerScreen} />
      <LogsStack.Screen name="ActiveWorkout" component={ActiveWorkoutScreen} options={{ headerShown: false }} />
      <LogsStack.Screen name="SessionDetail" component={SessionDetailView} options={{ headerShown: false }} />
    </LogsStack.Navigator>
  );
}

function AnalyticsStackScreen() {
  return (
    <AnalyticsStack.Navigator screenOptions={stackScreenOptions}>
      <AnalyticsStack.Screen name="AnalyticsHome" component={AnalyticsScreen} />
      <AnalyticsStack.Screen name="NutritionReport" component={NutritionReportScreen} />
      <AnalyticsStack.Screen name="WeeklyReport" component={WeeklyReportScreen} />
    </AnalyticsStack.Navigator>
  );
}

function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator screenOptions={stackScreenOptions}>
      <ProfileStack.Screen name="ProfileHome" component={ProfileScreen} />
      <ProfileStack.Screen name="Learn" component={LearnScreen} />
      <ProfileStack.Screen name="ArticleDetail">
        {({ route, navigation }: any) => (
          <ArticleDetailScreen
            articleId={route.params.articleId}
            onBack={() => navigation.goBack()}
          />
        )}
      </ProfileStack.Screen>
      <ProfileStack.Screen name="Coaching" component={CoachingScreen} />
      <ProfileStack.Screen name="Community" component={CommunityScreen} />
      <ProfileStack.Screen name="FounderStory" component={FounderStoryScreen} />
      <ProfileStack.Screen name="HealthReports" component={HealthReportsScreen} />
      <ProfileStack.Screen name="ProgressPhotos" component={ProgressPhotosScreen} />
      <ProfileStack.Screen name="MealPlan" component={MealPlanScreen} />
      <ProfileStack.Screen name="ShoppingList" component={ShoppingListView} />
      <ProfileStack.Screen name="PrepSunday" component={PrepSundayFlow} />
    </ProfileStack.Navigator>
  );
}

// ─── SVG Tab Icons ───────────────────────────────────────────────────────────

function TabSvgIcon({ name, color }: { name: keyof BottomTabParamList; color: string }) {
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
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={sw} />
          <Path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    default:
      return null;
  }
}

// ─── Bottom tabs ─────────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<BottomTabParamList>();

export function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.accent.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused }) => (
          <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
            <TabSvgIcon
              name={route.name as keyof BottomTabParamList}
              color={focused ? colors.accent.primary : colors.text.muted}
            />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Home" component={DashboardStackScreen} options={{ tabBarTestID: 'tab-home' }} />
      <Tab.Screen name="Log" component={LogsStackScreen} options={{ tabBarTestID: 'tab-log' }} />
      <Tab.Screen name="Analytics" component={AnalyticsStackScreen} options={{ tabBarTestID: 'tab-analytics' }} />
      <Tab.Screen name="Profile" component={ProfileStackScreen} options={{ tabBarTestID: 'tab-profile' }} />
    </Tab.Navigator>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bg.surface,
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
    backgroundColor: colors.accent.primaryMuted,
  },
});
