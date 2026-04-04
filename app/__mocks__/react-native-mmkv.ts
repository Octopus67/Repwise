// Mock for react-native-mmkv in Jest tests
export class MMKV {
  private store = new Map<string, string>();
  getString(key: string) { return this.store.get(key) ?? null; }
  set(key: string, value: string) { this.store.set(key, value); }
  delete(key: string) { this.store.delete(key); }
}
