// Mock for @sentry/react-native in Jest tests
export const captureException = jest.fn();
export const captureMessage = jest.fn();
export const addBreadcrumb = jest.fn();
export const init = jest.fn();
export const setTag = jest.fn();
export const withScope = jest.fn((cb: (scope: any) => void) => cb({ setTag: jest.fn(), setExtra: jest.fn() }));
export default { captureException, captureMessage, addBreadcrumb, init, setTag, withScope };
