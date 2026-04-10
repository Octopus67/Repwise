// Audit fix 4.2 — deep linking configuration
import { LinkingOptions, getStateFromPath as defaultGetStateFromPath } from '@react-navigation/native';

const linking: LinkingOptions<any> = {
  prefixes: ['repwise://', 'https://app.repwise.app'],
  config: {
    screens: {
      // Auth screens (unauthenticated)
      Login: 'login',
      ResetPassword: 'reset-password/:email',

      // Main tab navigator (authenticated)
      Home: {
        screens: {
          DashboardHome: 'dashboard',
          ActiveWorkout: 'workout/:id',
          ArticleDetail: 'article/:articleId',
        },
      },
      Log: {
        screens: {
          LogsHome: 'logs',
          SessionDetail: 'log/session/:sessionId',
        },
      },
      Analytics: {
        screens: {
          AnalyticsHome: 'analytics',
          ExerciseHistory: 'exercise/:exerciseName',
        },
      },
      Profile: {
        screens: {
          ProfileHome: 'profile',
          Coaching: 'coaching',
          Community: 'community',
          PRHistory: 'pr-history',
          WeeklyReport: 'weekly-report',
          Measurements: 'measurements',
          ProgressPhotos: 'progress-photos',
        },
      },
    },
  },
  getStateFromPath(path, options) {
    try {
      const state = defaultGetStateFromPath(path, options);
      if (state) return state;
    } catch {
      // Invalid deep link — fall through to home
    }
    return { routes: [{ name: 'Home' }] };
  },
};

export default linking;
