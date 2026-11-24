import { isAxiosError } from 'axios';
import type { ParseKeys } from 'i18next';
import { apiErrorText, isSilentApiError, serverMessage, serverMessageKey } from '@/lib/api-error';

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
  t: (key: ParseKeys) => string,
  write: boolean,
): string | null {
  if (isSilentApiError(error)) return null;
  const status = isAxiosError(error) ? error.response?.status : undefined;
  if (status === 413) return tooLarge;
  const key = serverMessageKey(error)?.trim();
  const message = serverMessage(error)?.trim();
  const code = key || message;
  if (
    status &&
    status >= 400 &&
    status < 500 &&
    code &&
    emptyFileKeys.includes(code) &&
    (!key || !message || message === key)
  )
    return emptyFile;
  return apiErrorText(error, () => fallback, t, { write });
}
