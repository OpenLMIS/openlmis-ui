import { isAxiosError } from 'axios';
import { serverMessage } from '@/components/display/dialog-parts';

type TransferErrorText = {
  fallback: string;
  emptyFile: string;
  tooLarge: string;
  /** Server message keys that mean the uploaded file was empty. */
  emptyFileKeys?: readonly string[];
};

/** The server's own message for a refused file, or a safe translated text otherwise. */
export function transferErrorMessage(
  error: unknown,
  { fallback, emptyFile, tooLarge, emptyFileKeys = [] }: TransferErrorText,
): string {
  if (!isAxiosError(error)) return fallback;
  const status = error.response?.status;
  if (status === 413) return tooLarge;
  if (!status || status < 400 || status >= 500) return fallback;
  const body: unknown = error.response?.data;
  if (!body || typeof body !== 'object') return fallback;
  const rawKey = 'messageKey' in body ? body.messageKey : undefined;
  const key = typeof rawKey === 'string' ? rawKey.trim() : undefined;
  const message = serverMessage(error)?.trim();
  if (key && message && message !== key) return message;
  if ((key && emptyFileKeys.includes(key)) || (message && emptyFileKeys.includes(message)))
    return emptyFile;
  return fallback;
}
