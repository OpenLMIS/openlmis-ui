import { isAxiosError } from 'axios';
import i18n from 'i18next';
import type { ErrorInfo } from 'react';
import {
  apiFieldMessages,
  hasApiErrorTranslation,
  isApiTimeout,
  isSilentApiError,
  serverMessageKey,
} from '@/lib/api-error';
import { isOfflineError } from '@/lib/http';

export function reportCaughtError(error: unknown, { componentStack }: ErrorInfo) {
  if (isOfflineError(error)) return;
  console.error(error, componentStack);
}

function diagnosticPath(url: string | undefined) {
  if (!url) return undefined;
  try {
    return new URL(url, 'https://openlmis.invalid').pathname;
  } catch {
    return undefined;
  }
}

export function reportApiError(error: unknown) {
  try {
    if (isSilentApiError(error) || (isOfflineError(error) && !isApiTimeout(error))) return;
    if (!isAxiosError(error)) {
      console.error(error);
      return;
    }
    const messageKey = serverMessageKey(error);
    const fields = messageKey ? [] : apiFieldMessages(error);
    const keys = new Set(fields.map(({ key }) => key));
    if (messageKey) keys.add(messageKey);
    const lineErrors: unknown = error.response?.data?.lineErrors;
    if (Array.isArray(lineErrors)) {
      for (const line of lineErrors) {
        if (!line || typeof line !== 'object' || !('messageKey' in line)) continue;
        const key = line.messageKey;
        if (typeof key === 'string' && key) keys.add(key);
      }
    }
    if (!keys.size) keys.add(undefined);
    const { config } = error;
    const status = error.response?.status;
    const path = diagnosticPath(config?.url);
    for (const key of keys) {
      if (key && hasApiErrorTranslation(key, (translation) => i18n.exists(translation))) continue;
      console.warn('API request failed', {
        method: config?.method?.toUpperCase(),
        ...(path === undefined ? {} : { path }),
        status,
        messageKey: key,
      });
    }
  } catch {
    // Diagnostics must not interrupt failure handling.
  }
}
