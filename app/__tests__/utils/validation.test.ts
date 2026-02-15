import { isValidEmail, trimEmail } from '../../utils/validation';

describe('isValidEmail', () => {
  test('accepts standard email', () => {
    expect(isValidEmail('user@domain.com')).toBe(true);
  });

  test('accepts email with plus tag and subdomain', () => {
    expect(isValidEmail('user+tag@sub.domain.co')).toBe(true);
  });

  test('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  test('rejects plain text without @', () => {
    expect(isValidEmail('asdf')).toBe(false);
  });

  test('rejects missing local part', () => {
    expect(isValidEmail('@domain')).toBe(false);
  });

  test('rejects missing domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  test('rejects email with space in local part', () => {
    expect(isValidEmail('user @domain.com')).toBe(false);
  });
});

describe('trimEmail', () => {
  test('removes leading whitespace', () => {
    expect(trimEmail('  user@domain.com')).toBe('user@domain.com');
  });

  test('removes trailing whitespace', () => {
    expect(trimEmail('user@domain.com   ')).toBe('user@domain.com');
  });

  test('removes both leading and trailing whitespace', () => {
    expect(trimEmail('  user@domain.com  ')).toBe('user@domain.com');
  });

  test('returns unchanged string when no whitespace', () => {
    expect(trimEmail('user@domain.com')).toBe('user@domain.com');
  });
});
