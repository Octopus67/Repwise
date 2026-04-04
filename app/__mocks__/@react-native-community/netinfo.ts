// Mock for @react-native-community/netinfo in Jest tests
export default {
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
};
