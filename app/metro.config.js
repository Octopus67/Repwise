const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Inject a global polyfill for __reanimatedLoggerConfig before any module loads.
// Fixes "ReferenceError: __reanimatedLoggerConfig is not defined" on web.
config.serializer = config.serializer || {};
const originalGetPolyfills = config.serializer.getPolyfills;
config.serializer.getPolyfills = (ctx) => {
  const base = originalGetPolyfills ? originalGetPolyfills(ctx) : [];
  return [
    path.resolve(__dirname, 'polyfills/reanimated-logger.js'),
    ...base,
  ];
};

// axios v1.x ships a Node.js-specific CJS build that requires Node built-ins.
// Redirect to the browser-compatible build.
const defaultResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'axios') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/axios/dist/browser/axios.cjs'),
      type: 'sourceFile',
    };
  }
  // @sentry/react-native uses native modules unavailable on web
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
