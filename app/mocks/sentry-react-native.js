// Web mock for @sentry/react-native
// Sentry React Native uses native modules unavailable on web.
// This stub prevents Metro bundling errors on web platform.

export function init() {}
export function captureException() {}
export function captureMessage() {}
export function setUser() {}
export function setTag() {}
export function setExtra() {}
export function addBreadcrumb() {}
export function withScope() {}
export function configureScope() {}
export const ReactNativeTracing = class {};
export const ReactNavigationInstrumentation = class {};
export const wrap = (component) => component;
export default {
  init,
  captureException,
  captureMessage,
  setUser,
  setTag,
  setExtra,
  addBreadcrumb,
  withScope,
  configureScope,
  ReactNativeTracing,
  ReactNavigationInstrumentation,
  wrap,
};
