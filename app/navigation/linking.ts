// Audit fix 4.2 — deep linking configuration
import { LinkingOptions, getStateFromPath as defaultGetStateFromPath } from '@react-navigation/native';

const prefixes = ['repwise://', 'https://app.repwise.app'];

function safeGetStateFromPath(fallbackRoute: string) {
  return function getStateFromPath(path: string, options: Parameters<typeof defaultGetStateFromPath>[1]) {
    try {
      const state = defaultGetStateFromPath(path, options);
      if (state) return state;
    } catch {
      // Invalid deep link — fall through to fallback
    }
    return { routes: [{ name: fallbackRoute }] };
  };
}

/** Linking config for unauthenticated users (auth screens only) */
export const authLinking: LinkingOptions<any> = {
  prefixes,
  config: {
    screens: {
      Login: 'login',
      ResetPassword: 'reset-password/:email',  // pragma: allowlist secret
    },
  },
  getStateFromPath: safeGetStateFromPath('Login'),
};

/** Linking config for authenticated users (all app screens) */
export const appLinking: LinkingOptions<any> = {
  prefixes,
  config: {
    screens: {
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
  getStateFromPath: safeGetStateFromPath('Home'),
};

// Default export for backward compatibility
export default appLinking;
