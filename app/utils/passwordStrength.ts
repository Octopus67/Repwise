import { zxcvbn } from '@zxcvbn-ts/core';

export type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordValidation {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasDigit: boolean;
}

export interface PasswordStrengthResult {
  score: number; // 0-4 from zxcvbn
  level: StrengthLevel;
  validation: PasswordValidation;
  isValid: boolean;
}

export function getPasswordStrength(password: string): PasswordStrengthResult {
  const validation: PasswordValidation = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasDigit: /[0-9]/.test(password),
  };

  if (!password) {
    return { score: 0, level: 'weak', validation, isValid: false };
  }

  const { score } = zxcvbn(password);

  let level: StrengthLevel;
  if (score <= 1) level = 'weak';
  else if (score === 2) level = 'fair';
  else if (score === 3) level = 'good';
  else level = 'strong';

  const isValid = validation.minLength &&
    validation.hasUppercase &&
    validation.hasLowercase &&
    validation.hasDigit &&
    score >= 2;

  return { score, level, validation, isValid };
}
