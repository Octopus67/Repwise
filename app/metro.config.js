const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Inject a global polyfill for __reanimatedLoggerConfig before any module loads.
// This fixes "ReferenceError: __reanimatedLoggerConfig is not defined" on web
// when Reanimated's logger module is loaded lazily before the global is set.
config.serializer = config.serializer || {};
const originalGetPolyfills = config.serializer.getPolyfills;
config.serializer.getPolyfills = (ctx) => {
  const base = originalGetPolyfills ? originalGetPolyfills(ctx) : [];
  return [
    path.resolve(__dirname, 'polyfills/reanimated-logger.js'),
    ...base,
  ];
};

const config = getDefaultConfig(__dirname);

// axios v1.x ships a Node.js-specific CJS build (dist/node/axios.cjs) that
// requires Node built-ins (crypto, http, url) unavailable in React Native.
// Redirect any resolution of the node build to the browser-compatible build.
const defaultResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'axios') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/axios/dist/browser/axios.cjs'),
      type: 'sourceFile',
    };
  }
  // @sentry/react-native uses native modules unavailable on web — use a stub
  if (moduleName === '@sentry/react-native' && platform === 'web') {
    return {
      filePath: path.resolve(__dirname, 'mocks/sentry-react-native.js'),
      type: 'sourceFile',
    };
  }
  if (defaultResolver) {
    return defaultResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
