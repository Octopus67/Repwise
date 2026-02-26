// Polyfill for react-native-reanimated on web.
// __reanimatedLoggerConfig must exist as a global before any Reanimated
// module accesses it, otherwise lazy bundling causes a ReferenceError.
if (typeof global.__reanimatedLoggerConfig === 'undefined') {
  global.__reanimatedLoggerConfig = {
    level: 1, // LogLevel.warn
    strict: false,
    logFunction: undefined,
  };
}
