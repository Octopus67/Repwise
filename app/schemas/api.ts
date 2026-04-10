/**
 * Zod schemas for critical API response validation.
 *
 * Uses safeParse so validation failures don't crash — just log a warning
 * and fall through to raw data.
 */

import { z } from 'zod';

export const PaymentStatusSchema = z.object({
  status: z.enum(['free', 'pending_payment', 'active', 'past_due', 'cancelled']),
  plan: z.string().optional(),
  expiresAt: z.string().optional(),
});

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.string(),
  emailVerified: z.boolean(),
});

export const AuthMeSchema = UserProfileSchema;

/**
 * Validate API response data with a Zod schema.
 * Returns the raw data regardless — logs a warning on validation failure.
 */
export function validateApiResponse<D>(schema: z.ZodType, data: D, label: string): D {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(`[Zod] ${label} validation failed:`, result.error.issues);
  }
  return data;
}
