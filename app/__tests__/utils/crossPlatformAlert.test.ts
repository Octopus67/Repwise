/**
 * Tests for crossPlatformAlert utility.
 *
 * Jest runs in node environment (no window), so we mock both
 * react-native and the global window object.
 */

// Mock react-native
const mockAlertAlert = jest.fn();
let mockPlatformOS = 'web';

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
  Alert: {
    alert: (...args: any[]) => mockAlertAlert(...args),
  },
}));

// Provide window.alert / window.confirm for web tests (node env has no window)
const mockWindowAlert = jest.fn();
const mockWindowConfirm = jest.fn<boolean, [string?]>().mockReturnValue(true);

(globalThis as any).window = {
  alert: mockWindowAlert,
  confirm: mockWindowConfirm,
};

import { showAlert } from '../../utils/crossPlatformAlert';

afterEach(() => {
  jest.clearAllMocks();
  mockPlatformOS = 'web';
  mockWindowConfirm.mockReturnValue(true);
});

describe('showAlert — native (non-web)', () => {
  beforeEach(() => {
    mockPlatformOS = 'ios';
  });

  it('delegates to Alert.alert on native', () => {
    const onPress = jest.fn();
    const buttons = [{ text: 'OK', onPress }];
    showAlert('Title', 'Message', buttons);
    expect(mockAlertAlert).toHaveBeenCalledWith('Title', 'Message', buttons);
  });

  it('passes undefined message through', () => {
    showAlert('Title');
    expect(mockAlertAlert).toHaveBeenCalledWith('Title', undefined, undefined);
  });

  it('works on android too', () => {
    mockPlatformOS = 'android';
    showAlert('Hey', 'There', [{ text: 'OK' }]);
    expect(mockAlertAlert).toHaveBeenCalledWith('Hey', 'There', [{ text: 'OK' }]);
  });
});

describe('showAlert — web', () => {
  beforeEach(() => {
    mockPlatformOS = 'web';
  });

  it('calls window.alert for no buttons', () => {
    showAlert('Info', 'Something happened');
    expect(mockWindowAlert).toHaveBeenCalledWith('Info\nSomething happened');
  });

  it('calls window.alert for 1 button and fires onPress', () => {
    const onPress = jest.fn();
    showAlert('Done', 'Saved.', [{ text: 'OK', onPress }]);
    expect(mockWindowAlert).toHaveBeenCalledWith('Done\nSaved.');
    expect(onPress).toHaveBeenCalled();
  });

  it('calls window.confirm for 2 buttons — OK triggers non-cancel', () => {
    mockWindowConfirm.mockReturnValue(true);
    const cancelPress = jest.fn();
    const actionPress = jest.fn();
    showAlert('Discard?', 'All progress lost.', [
      { text: 'Cancel', style: 'cancel', onPress: cancelPress },
      { text: 'Discard', style: 'destructive', onPress: actionPress },
    ]);
    expect(mockWindowConfirm).toHaveBeenCalledWith('Discard?\nAll progress lost.');
    expect(actionPress).toHaveBeenCalled();
    expect(cancelPress).not.toHaveBeenCalled();
  });

  it('calls window.confirm for 2 buttons — Cancel triggers cancel button', () => {
    mockWindowConfirm.mockReturnValue(false);
    const cancelPress = jest.fn();
    const actionPress = jest.fn();
    showAlert('Discard?', 'All progress lost.', [
      { text: 'Cancel', style: 'cancel', onPress: cancelPress },
      { text: 'Discard', style: 'destructive', onPress: actionPress },
    ]);
    expect(cancelPress).toHaveBeenCalled();
    expect(actionPress).not.toHaveBeenCalled();
  });

  it('handles 3+ buttons — OK triggers destructive action', () => {
    mockWindowConfirm.mockReturnValue(true);
    const cancel = jest.fn();
    const keep = jest.fn();
    const discard = jest.fn();
    showAlert('Unsaved', 'What to do?', [
      { text: 'Keep', onPress: keep },
      { text: 'Discard', style: 'destructive', onPress: discard },
      { text: 'Cancel', style: 'cancel', onPress: cancel },
    ]);
    expect(discard).toHaveBeenCalled();
    expect(keep).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('handles 3+ buttons — Cancel triggers cancel button', () => {
    mockWindowConfirm.mockReturnValue(false);
    const cancel = jest.fn();
    const keep = jest.fn();
    const discard = jest.fn();
    showAlert('Unsaved', 'What to do?', [
      { text: 'Keep', onPress: keep },
      { text: 'Discard', style: 'destructive', onPress: discard },
      { text: 'Cancel', style: 'cancel', onPress: cancel },
    ]);
    expect(cancel).toHaveBeenCalled();
    expect(discard).not.toHaveBeenCalled();
  });

  it('handles title-only alert (no message)', () => {
    showAlert('Just a title');
    expect(mockWindowAlert).toHaveBeenCalledWith('Just a title');
  });

  it('handles buttons without onPress gracefully', () => {
    mockWindowConfirm.mockReturnValue(true);
    expect(() => {
      showAlert('Test', 'msg', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OK' },
      ]);
    }).not.toThrow();
  });
});
