declare module 'react-native-watch-connectivity' {
  interface WatchEventSubscription {
    remove(): void;
  }
  export const watchEvents: {
    on(event: string, handler: (message: Record<string, unknown>) => void): WatchEventSubscription;
  };
  export function sendMessage(message: Record<string, unknown>): Promise<void>;
  export function updateApplicationContext(ctx: Record<string, unknown>): Promise<void>;
}
