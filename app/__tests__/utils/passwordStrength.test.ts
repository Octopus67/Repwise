import { getPasswordStrength } from '../../utils/passwordStrength';

describe('getPasswordStrength', () => {
  it('returns weak for empty password', async () => {
    const result = await getPasswordStrength('');
    expect(result.level).toBe('weak');
    expect(result.isValid).toBe(false);
  });

  it('validates minimum length', async () => {
    expect((await getPasswordStrength('short')).validation.minLength).toBe(false);
    expect((await getPasswordStrength('longenough')).validation.minLength).toBe(true);
  });

  it('isValid requires length >= 8, uppercase, lowercase, digit, special char, and score >= 2', async () => {
    expect((await getPasswordStrength('Abcdefg1!')).isValid).toBe(true);
    expect((await getPasswordStrength('1234567')).isValid).toBe(false);
  });

  it('isValid is false when missing uppercase, lowercase, or digit', async () => {
    const result = await getPasswordStrength('alllowercase');
    expect(result.isValid).toBe(false);
    expect(result.validation).toEqual({ minLength: true, hasUppercase: false, hasLowercase: true, hasDigit: false, hasSpecialChar: false });
  });

  it('returns strong for complex passwords', async () => {
    const result = await getPasswordStrength('C0mpl3x!P@ssw0rd#2024');
    expect(result.level).toBe('strong');
    expect(result.score).toBe(4);
  });

  it('returns weak for simple passwords', async () => {
    const result = await getPasswordStrength('aaa');
    expect(result.level).toBe('weak');
  });
});
