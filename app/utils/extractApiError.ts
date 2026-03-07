/** Extract a user-facing message from an API error, checking both .message and .detail fields,
 *  and detecting network errors (no response). */
export function extractApiError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string; detail?: string } } };
  if (!e?.response) return 'No internet connection. Please check your network and try again.';
  return e.response.data?.message ?? e.response.data?.detail ?? fallback;
}
