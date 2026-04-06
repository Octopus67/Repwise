// Audit fix 7.5 — password strength with lazy-loaded zxcvbn

export type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordValidation {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasDigit: boolean;
  hasSpecialChar: boolean;
}

export interface PasswordStrengthResult {
  score: number; // 0-4 from zxcvbn
  level: StrengthLevel;
  validation: PasswordValidation;
  isValid: boolean;
}

// Lazy-load zxcvbn in background — sync callers get a heuristic until it loads
let _zxcvbn: ((pw: string) => { score: number }) | null = null;
import('@zxcvbn-ts/core')
  .then((mod) => { _zxcvbn = mod.zxcvbn; })
  .catch((e) => { console.warn('[passwordStrength] zxcvbn unavailable, using heuristic:', e.message); });

function heuristicScore(password: string, v: PasswordValidation): number {
  let s = 0;
  if (v.minLength) s++;
  if (v.hasUppercase && v.hasLowercase) s++;
  if (v.hasDigit) s++;
  if (v.hasSpecialChar) s++;
  return Math.min(s, 4);
}

export function getPasswordStrength(password: string): PasswordStrengthResult {
  const validation: PasswordValidation = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasDigit: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
  };

  if (!password) {
    return { score: 0, level: 'weak', validation, isValid: false };
  }

  const score = _zxcvbn ? _zxcvbn(password).score : heuristicScore(password, validation);

  let level: StrengthLevel;
  if (score <= 1) level = 'weak';
  else if (score === 2) level = 'fair';
  else if (score === 3) level = 'good';
  else level = 'strong';

  const isValid = validation.minLength &&
    validation.hasUppercase &&
    validation.hasLowercase &&
    validation.hasDigit &&
    validation.hasSpecialChar &&
    score >= 2;

  return { score, level, validation, isValid };
}
