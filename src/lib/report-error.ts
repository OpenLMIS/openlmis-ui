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

export function reportApiError(error: unknown) {
  if (isSilentApiError(error) || (isOfflineError(error) && !isApiTimeout(error))) return;
  const messageKey = serverMessageKey(error);
  const fields = messageKey ? [] : apiFieldMessages(error);
  const keys = new Set(fields.length ? fields.map(({ key }) => key) : [messageKey]);
  const config = isAxiosError(error) ? error.config : undefined;
  const status = isAxiosError(error) ? error.response?.status : undefined;
  const path = config?.url
    ? URL.parse(config.url, 'https://openlmis.invalid')?.pathname
    : undefined;
  for (const key of keys) {
    if (key && hasApiErrorTranslation(key, (translation) => i18n.exists(translation))) continue;
    console.warn('API request failed', {
      method: config?.method?.toUpperCase(),
      path,
      status,
      messageKey: key,
    });
  }
}
