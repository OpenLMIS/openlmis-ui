import { AxiosError, isAxiosError, isCancel } from 'axios';
import type { ParseKeys } from 'i18next';
import { isAccessFallbackError, isOfflineError, isUnauthorized } from '@/lib/http';
import { SessionEndedError } from '@/lib/session-scope';

export function serverMessage(error: unknown): string | undefined {
  if (!isAxiosError(error)) return undefined;
  const message = (error.response?.data as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' && message ? message : undefined;
}

export function serverMessageKey(error: unknown): string | undefined {
  if (!isAxiosError(error)) return undefined;
  const key = (error.response?.data as { messageKey?: unknown } | undefined)?.messageKey;
  return typeof key === 'string' && key ? key : undefined;
}

const technicalKeys = new Set([
  'error.sendRequest',
  'cce.error.io',
  'stockmanagement.error.authorization.failed',
]);

const existingTranslations = new Map<string, ParseKeys>([
  ['notification.error.userContactDetails.email.invalid', 'users.form.email-invalid'],
  ['referenceData.error.facility.code.mustBeUnique', 'facilities.form.code-taken'],
  ['referenceData.error.facilityType.code.duplicated', 'facility-types.form.code-taken'],
  ['referenceData.error.facilityType.name.duplicated', 'facility-types.form.name-taken'],
  ['referenceData.error.orderable.productCode.mustBeUnique', 'products.form.code-taken'],
  ['referenceData.error.program.code.duplicated', 'programs.form.code-taken'],
  ['referenceData.error.lot.lotCode.mustBeUnique', 'lots.form.code-taken'],
  [
    'referenceData.error.processingSchedule.code.duplicated',
    'processing-schedules.form.code-taken',
  ],
  [
    'referenceData.error.processingSchedule.name.duplicated',
    'processing-schedules.form.name-taken',
  ],
  ['requisition.error.validation.templateNameDuplication', 'requisition-templates.form.name-taken'],
  [
    'stockmanagement.error.event.cancellation.reason.required',
    'stock-event-reverse.reason-required',
  ],
  ['stockmanagement.error.event.cancellation.reason.invalid', 'stock-event-reverse.reason-invalid'],
]);

export function isSilentApiError(error: unknown) {
  return (
    error instanceof SessionEndedError ||
    isCancel(error) ||
    (isAxiosError(error) &&
      (error.code === AxiosError.ERR_CANCELED ||
        (isUnauthorized(error) && error.config?.session !== false && !error.config?.anonymous)))
  );
}

export function isApiTimeout(error: unknown) {
  return (
    isAxiosError(error) &&
    (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT)
  );
}

const catalogKey = (key: string) => `api-error.${key}` as ParseKeys;

export function hasApiErrorTranslation(key: string, exists: (key: ParseKeys) => boolean) {
  return !technicalKeys.has(key) && (existingTranslations.has(key) || exists(catalogKey(key)));
}

type TranslateError = (key: ParseKeys) => string;

export function keyedApiErrorText(
  key: string | undefined,
  message: string | undefined,
  t: TranslateError,
) {
  if (!key) return message?.trim() ? message : undefined;
  if (technicalKeys.has(key)) return undefined;
  const candidate = catalogKey(key);
  const translated = t(candidate);
  if (translated && translated !== candidate) return translated;
  const existing = existingTranslations.get(key);
  if (existing) return t(existing);
  return message?.trim() && message !== key ? message : undefined;
}

export function apiErrorText(
  error: unknown,
  fallbackKey: ParseKeys | (() => string),
  t: TranslateError,
  { write, allowServerMessage = true }: { write?: boolean; allowServerMessage?: boolean } = {},
): string | null {
  if (isSilentApiError(error)) return null;
  if (isApiTimeout(error) && isAxiosError(error)) {
    const method = error.config?.method?.toUpperCase();
    const isWrite =
      write ?? (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE');
    return t(isWrite ? 'api-error.timeout-write' : 'api-error.timeout-read');
  }
  if (isOfflineError(error) || isAccessFallbackError(error)) return t('error.check-connection');
  const key = serverMessageKey(error);
  return (
    (key && keyedApiErrorText(key, allowServerMessage ? serverMessage(error) : undefined, t)) ||
    (typeof fallbackKey === 'function' ? fallbackKey() : t(fallbackKey))
  );
}

type ApiFieldError<Field extends string> = { field: Field; key: ParseKeys };

export function fieldErrorFor<const Field extends string>(
  error: unknown,
  table: Readonly<Record<string, ApiFieldError<Field>>>,
): ApiFieldError<Field> | undefined {
  if (isSilentApiError(error)) return undefined;
  const key = serverMessageKey(error);
  return key && Object.hasOwn(table, key) ? table[key] : undefined;
}

const errorEnvelopeFields = new Set([
  'detail',
  'error',
  'error_description',
  'exception',
  'instance',
  'message',
  'messageKey',
  'path',
  'status',
  'timestamp',
  'title',
  'trace',
  'type',
]);

export function apiFieldMessages(error: unknown) {
  if (!isAxiosError(error) || error.response?.status !== 400 || serverMessageKey(error)) return [];
  const data: unknown = error.response.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const entries = Object.entries(data);
  if (entries.some(([field]) => errorEnvelopeFields.has(field))) return [];
  return entries.flatMap(([field, value]: [string, unknown]) => {
    if (typeof value === 'string' && value.trim())
      return [{ field, message: value, key: undefined }];
    if (!value || typeof value !== 'object') return [];
    const key =
      'messageKey' in value && typeof value.messageKey === 'string' && value.messageKey
        ? value.messageKey
        : undefined;
    const message =
      'message' in value && typeof value.message === 'string' && value.message.trim()
        ? value.message
        : undefined;
    return key || message ? [{ field, key, message }] : [];
  });
}
