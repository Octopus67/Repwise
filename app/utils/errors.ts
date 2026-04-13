import { AxiosError } from 'axios';

export function getErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) return err.response?.data?.message || err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    if (!err.response) return 'No internet connection. Please check your network and try again.';
    return err.response.data?.message ?? err.response.data?.detail ?? fallback;
  }
  return fallback;
}

/** Check if an error is a network connectivity error (vs server error). */
export function isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  if ('message' in err && typeof (err as { message: string }).message === 'string') {
    const msg = (err as { message: string }).message;
    return msg.includes('Network Error') || msg.includes('timeout') || msg.includes('network request failed');
  }
  if ('response' in err) return false;
  return true;
}