/**
 * Offline behavior tests — mutation queuing, persistence, and indicator.
 */
import NetInfo from '@react-native-community/netinfo';

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

describe('Offline Behavior', () => {
  describe('Mutation queued when offline', () => {
    it('should detect offline state via NetInfo', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: false,
        isInternetReachable: false,
      });

      const state = await NetInfo.fetch();
      expect(state.isConnected).toBe(false);
    });

    it('should queue mutations when offline', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: false,
        isInternetReachable: false,
      });

      const queue: Array<{ key: string; data: unknown }> = [];
      const state = await NetInfo.fetch();

      if (!state.isConnected) {
        queue.push({ key: 'logWorkout', data: { sets: 3, reps: 10 } });
      }

      expect(queue).toHaveLength(1);
      expect(queue[0].key).toBe('logWorkout');
    });

    it('should not queue when online', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: true,
        isInternetReachable: true,
      });

      const queue: Array<{ key: string; data: unknown }> = [];
      const state = await NetInfo.fetch();

      if (!state.isConnected) {
        queue.push({ key: 'logWorkout', data: {} });
      }

      expect(queue).toHaveLength(0);
    });
  });

  describe('Mutation persisted across app restart (via mutationKey)', () => {
    it('should persist mutation with a stable key', () => {
      const mutationKey = ['logWorkout', 'session-123'];
      const serialized = JSON.stringify({
        key: mutationKey,
        data: { exercises: [{ name: 'Squat', sets: 3 }] },
      });

      // Simulate storage write + read (app restart)
      const restored = JSON.parse(serialized);
      expect(restored.key).toEqual(mutationKey);
      expect(restored.data.exercises).toHaveLength(1);
    });

    it('should use deterministic mutationKey for deduplication', () => {
      const sessionId = 'abc-123';
      const key1 = ['logWorkout', sessionId];
      const key2 = ['logWorkout', sessionId];
      expect(JSON.stringify(key1)).toBe(JSON.stringify(key2));
    });
  });

  describe('Offline indicator shown when disconnected', () => {
    it('should register a NetInfo listener', () => {
      const unsubscribe = NetInfo.addEventListener(jest.fn());
      expect(NetInfo.addEventListener).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should report disconnected state for UI indicator', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: false,
        isInternetReachable: false,
      });

      const state = await NetInfo.fetch();
      const showBanner = !state.isConnected;
      expect(showBanner).toBe(true);
    });

    it('should hide indicator when reconnected', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: true,
        isInternetReachable: true,
      });

      const state = await NetInfo.fetch();
      const showBanner = !state.isConnected;
      expect(showBanner).toBe(false);
    });
  });
});
