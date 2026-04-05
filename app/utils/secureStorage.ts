import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const TOKEN_KEYS = { access: 'rw_access_token', refresh: 'rw_refresh_token' } as const;

// Audit fix 2.5 — web uses httpOnly cookies set by the server,
// so client-side storage is a no-op on web. Mobile continues using SecureStore.

export async function secureSet(key: string, value: string) {
  if (Platform.OS === 'web') { return; /* httpOnly cookies managed by server */ }
  else { await SecureStore.setItemAsync(key, value); }
}

export async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') { return null; /* httpOnly cookies sent automatically by browser */ }
  return SecureStore.getItemAsync(key);
}

export async function secureDelete(key: string) {
  if (Platform.OS === 'web') { return; /* cookie cleared via server logout */ }
  else { await SecureStore.deleteItemAsync(key); }
}
