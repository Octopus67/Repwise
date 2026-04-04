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

  it('isValid requires length >= 8, uppercase, lowercase, digit, and score >= 2', () => {
    expect(getPasswordStrength('Abcdefg1').isValid).toBe(true);
    expect(getPasswordStrength('1234567').isValid).toBe(false);
  });

  it('isValid is false when missing uppercase, lowercase, or digit', () => {
    const result = getPasswordStrength('alllowercase');
    expect(result.isValid).toBe(false);
    expect(result.validation).toEqual({ minLength: true, hasUppercase: false, hasLowercase: true, hasDigit: false });
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
