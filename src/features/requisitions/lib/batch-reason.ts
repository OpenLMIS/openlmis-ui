import type { ParseKeys, TFunction } from 'i18next';

export type BatchReason = { key: ParseKeys } | { message: string };
const keys: readonly ParseKeys[] = [
  'requisitions.batch.verification-failed',
  'requisitions.batch.no-longer-awaiting',
  'requisitions.batch.review-refreshed',
  'requisitions.batch.possibly-approved',
  'requisitions.batch.uncertain',
  'requisitions.batch.invalid-requisition',
  'requisitions.batch.save-failed',
  'requisitions.batch.missing',
  'requisitions.edit.outdated-title',
];
export function batchReason(message: string): BatchReason {
  const key = keys.find((key) => key === message);
  return key ? { key } : { message };
}
export function batchReasonText(reason: BatchReason | undefined, t: TFunction) {
  if (!reason) return t('requisitions.batch.missing');
  return 'key' in reason ? t(reason.key) : reason.message;
}
