import { zxcvbn } from '@zxcvbn-ts/core';

export type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordValidation {
  minLength: boolean;
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
  };

  const isValid = validation.minLength;

  if (!password) {
    return { score: 0, level: 'weak', validation, isValid };
  }

  const { score } = zxcvbn(password);

  let level: StrengthLevel;
  if (score <= 1) level = 'weak';
  else if (score === 2) level = 'fair';
  else if (score === 3) level = 'good';
  else level = 'strong';

  return { score, level, validation, isValid };
}
