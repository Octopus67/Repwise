// Initialize Reanimated BEFORE any other imports.
// This fixes "__reanimatedLoggerConfig is not defined" on web with lazy bundling.
// The global must exist before any Reanimated module accesses it.
if (typeof global.__reanimatedLoggerConfig === 'undefined') {
  global.__reanimatedLoggerConfig = {
    level: 1, // LogLevel.warn = 1
    strict: false,
    logFunction: undefined,
  };
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
