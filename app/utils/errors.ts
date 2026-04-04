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
