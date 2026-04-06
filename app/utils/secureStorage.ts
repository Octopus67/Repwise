import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const TOKEN_KEYS = { access: 'rw_access_token', refresh: 'rw_refresh_token' } as const;

// Mobile: expo-secure-store (encrypted keychain/keystore)
// Web: localStorage (no SecureStore available; httpOnly cookies are ideal
//       but require server-side cookie management which isn't implemented)

export async function secureSet(key: string, value: string) {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(key, value); } catch { /* SSR or private browsing */ }
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

export async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  return SecureStore.getItemAsync(key);
}

export async function secureDelete(key: string) {
  if (Platform.OS === 'web') {
    try { localStorage.removeItem(key); } catch { /* SSR or private browsing */ }
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}
