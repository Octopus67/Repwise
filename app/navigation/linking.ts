// Audit fix 4.2 — deep linking configuration
import { LinkingOptions } from '@react-navigation/native';

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
        },
      },
    },
  },
};

export default linking;
