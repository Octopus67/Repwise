import { MMKV } from 'react-native-mmkv';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const mmkv = new MMKV({ id: 'repwise-query-cache' });

export const mmkvPersister = createSyncStoragePersister({
  storage: {
    getItem: (key: string) => {
      try {
        return mmkv.getString(key) ?? null;
      } catch (e) {
        console.warn('MMKV getItem failed, clearing storage:', e);
        try { mmkv.clearAll(); } catch (_) { /* ignore */ }
        return null;
      }
    },
    setItem: (key: string, value: string) => {
      try {
        mmkv.set(key, value);
      } catch (e) {
        console.warn('MMKV setItem failed, clearing storage:', e);
        try { mmkv.clearAll(); } catch (_) { /* ignore */ }
      }
    },
    removeItem: (key: string) => {
      try {
        mmkv.delete(key);
      } catch (e) {
        console.warn('MMKV removeItem failed, clearing storage:', e);
        try { mmkv.clearAll(); } catch (_) { /* ignore */ }
      }
    },
  },
});
