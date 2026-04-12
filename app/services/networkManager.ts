import NetInfo from '@react-native-community/netinfo';
import { onlineManager, focusManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

export function setupNetworkManager() {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected && state.isInternetReachable !== false);
    });
  });
}

export function setupFocusManager(): void {
  focusManager.setEventListener((handleFocus) => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      handleFocus(state === 'active');
    });
    return () => sub.remove();
  });
}
