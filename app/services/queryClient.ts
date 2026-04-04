// Required packages (install before use):
// npx expo install @tanstack/react-query @tanstack/react-query-persist-client @tanstack/query-sync-storage-persister react-native-mmkv @react-native-community/netinfo
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      gcTime: 1000 * 60 * 60 * 24, // persist mutations 24h for offline replay
    },
  },
});
