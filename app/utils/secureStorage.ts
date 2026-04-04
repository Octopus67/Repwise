import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const TOKEN_KEYS = { access: 'rw_access_token', refresh: 'rw_refresh_token' } as const;

export async function secureSet(key: string, value: string) {
  if (Platform.OS === 'web') { localStorage.setItem(key, value); }
  else { await SecureStore.setItemAsync(key, value); }
}

export async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') { return localStorage.getItem(key); }
  return SecureStore.getItemAsync(key);
}

export async function secureDelete(key: string) {
  if (Platform.OS === 'web') { localStorage.removeItem(key); }
  else { await SecureStore.deleteItemAsync(key); }
}
