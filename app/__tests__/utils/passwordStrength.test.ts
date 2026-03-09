import { getPasswordStrength } from '../../utils/passwordStrength';

describe('getPasswordStrength', () => {
  it('returns weak for empty password', () => {
    const result = getPasswordStrength('');
    expect(result.level).toBe('weak');
    expect(result.isValid).toBe(false);
  });

  it('validates minimum length', () => {
    expect(getPasswordStrength('short').validation.minLength).toBe(false);
    expect(getPasswordStrength('longenough').validation.minLength).toBe(true);
  });

  it('isValid is true when length >= 8', () => {
    expect(getPasswordStrength('12345678').isValid).toBe(true);
    expect(getPasswordStrength('abcdefgh').isValid).toBe(true);
    expect(getPasswordStrength('1234567').isValid).toBe(false);
  });

  it('does not require uppercase, lowercase, number, or special char', () => {
    const result = getPasswordStrength('alllowercase');
    expect(result.isValid).toBe(true);
    expect(result.validation).toEqual({ minLength: true });
  });

  it('returns strong for complex passwords', () => {
    const result = getPasswordStrength('C0mpl3x!P@ssw0rd#2024');
    expect(result.level).toBe('strong');
    expect(result.score).toBe(4);
  });

  it('returns weak for simple passwords', () => {
    const result = getPasswordStrength('aaa');
    expect(result.level).toBe('weak');
  });
});
