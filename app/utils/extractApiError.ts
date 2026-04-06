/** Extract a user-facing message from an API error, checking .message, .detail,
 *  and .details[] (Pydantic validation errors). Detects network errors (no response). */
export function extractApiError(err: unknown, fallback: string): string {
  const e = err as {
    response?: {
      data?: {
        message?: string;
        detail?: string;
        details?: { field?: string; message?: string }[];
      };
    };
  };
  if (!e?.response) return 'No internet connection. Please check your network and try again.';

  // Pydantic validation errors: extract the first specific message
  const details = e.response.data?.details;
  if (details?.length) {
    const msg = details[0].message;
    if (msg) {
      // Strip "Value error, " prefix that Pydantic adds
      return msg.replace(/^Value error,\s*/i, '');
    }
  }

  return e.response.data?.message ?? e.response.data?.detail ?? fallback;
}
