/**
 * Email validation and sanitization utilities.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Returns true if the given string is a valid email address.
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Trims leading and trailing whitespace from an email string.
 */
export function trimEmail(email: string): string {
  return email.trim();
}
