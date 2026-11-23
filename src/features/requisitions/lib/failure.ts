import { isAxiosError } from 'axios';
import type { ParseKeys } from 'i18next';
import { apiErrorText, apiFieldMessages, keyedApiErrorText } from '@/lib/api-error';

export class RequisitionRetryConflict extends Error {}
export class ApprovalInProgress extends Error {}
export type RequisitionFailure =
  | { kind: 'server'; message: string }
  | { kind: 'request'; error: unknown; write: boolean }
  | { kind: 'reconciling' }
  | { kind: 'forbidden' }
  | { kind: 'conflict' }
  | { kind: 'key-used' };

export function toRequisitionFailure(error: unknown, write = true): RequisitionFailure {
  if (error instanceof ApprovalInProgress) return { kind: 'server', message: error.message };
  const status = isAxiosError(error) ? error.response?.status : undefined;
  if (status === 409) {
    const keyUsed =
      isAxiosError(error) &&
      error.response?.data?.messageKey ===
        'requisition.error.validation.idempotencyKey.alreadyUsed';
    return { kind: keyUsed ? 'key-used' : 'conflict' };
  }
  if (error instanceof RequisitionRetryConflict) return { kind: 'conflict' };
  if (status === 403) return { kind: 'forbidden' };
  return { kind: 'request', error, write };
}

export function requisitionFailureText(
  failure: Extract<RequisitionFailure, { kind: 'server' | 'request' }>,
  fallback: ParseKeys,
  t: (key: ParseKeys) => string,
) {
  if (failure.kind === 'server') return failure.message;
  const { error, write } = failure;
  const description = apiErrorText(error, fallback, t, { write });
  if (description === null) return null;
  const fields = apiFieldMessages(error)
    .map(({ key, message }) => keyedApiErrorText(key, message, t))
    .filter(Boolean);
  return fields.length ? fields.join('\n') : description;
}
