/**
 * Navigation type definitions for Repwise.
 *
 * Re-exports param lists defined in navigator files and provides
 * convenience screen-prop types so screens can replace `any`.
 */

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// Re-export param lists from their source-of-truth locations
export type {
  DashboardStackParamList,
  LogsStackParamList,
  AnalyticsStackParamList,
  ProfileStackParamList,
  BottomTabParamList,
} from '../navigation/BottomTabNavigator';

// Auth stack is defined in App.tsx — mirror it here for screen typing.
// Keep in sync with the AuthStackParamList in App.tsx.
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email: string };
  EmailVerification: { email: string };
};

// ─── Convenience screen-prop types ───────────────────────────────────────────

export type AuthScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type DashboardScreenProps<T extends keyof import('../navigation/BottomTabNavigator').DashboardStackParamList> =
  NativeStackScreenProps<import('../navigation/BottomTabNavigator').DashboardStackParamList, T>;

export type LogsScreenProps<T extends keyof import('../navigation/BottomTabNavigator').LogsStackParamList> =
  NativeStackScreenProps<import('../navigation/BottomTabNavigator').LogsStackParamList, T>;

export type AnalyticsScreenProps<T extends keyof import('../navigation/BottomTabNavigator').AnalyticsStackParamList> =
  NativeStackScreenProps<import('../navigation/BottomTabNavigator').AnalyticsStackParamList, T>;

export type ProfileScreenProps<T extends keyof import('../navigation/BottomTabNavigator').ProfileStackParamList> =
  NativeStackScreenProps<import('../navigation/BottomTabNavigator').ProfileStackParamList, T>;
