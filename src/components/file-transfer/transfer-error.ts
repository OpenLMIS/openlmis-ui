import { isAxiosError } from 'axios';
import { serverMessage, serverMessageKey } from '@/components/display/dialog-parts';

type TransferErrorText = {
  fallback: string;
  emptyFile: string;
  tooLarge: string;
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
  const key = serverMessageKey(error)?.trim();
  const message = serverMessage(error)?.trim();
  if (key && message && message !== key) return message;
  const code = key || message;
  return code && emptyFileKeys.includes(code) ? emptyFile : fallback;
}
