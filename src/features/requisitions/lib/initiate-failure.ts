import { isAxiosError } from 'axios';
import type { ParseKeys } from 'i18next';
import { requisitionFailureText, toRequisitionFailure } from '@/features/requisitions/lib/failure';

import { isSilentApiError } from '@/lib/api-error';

const MESSAGES: Record<string, ParseKeys> = {
  'requisition.error.facilityDoesNotSupportProgram':
    'requisitions.initiate.error.not-supported-description',
  'requisition.error.initiate.finishPreviousRequisition':
    'requisitions.initiate.error.finish-previous',
  'requisition.error.initiate.periodShouldBeOldestAndNotAssociated':
    'requisitions.initiate.error.no-period',
  'requisition.error.initiate.incorrectSuggestedPeriod':
    'requisitions.initiate.error.no-emergency-period',
  'requisition.error.requisitionTemplateNotFound': 'requisitions.initiate.error.no-template',
  'requisition.error.validation.idempotencyKey.alreadyUsed': 'requisitions.initiate.error.key-used',
};
export function initiateFailureMessage(
  error: unknown,
  t: (key: ParseKeys) => string,
  write = true,
) {
  if (isSilentApiError(error)) return null;
  const key = isAxiosError(error) ? error.response?.data?.messageKey : undefined;
  if (typeof key === 'string' && MESSAGES[key]) return t(MESSAGES[key]);
  const failure = toRequisitionFailure(error, write);
  if (failure.kind === 'forbidden') return t('no-access.description');
  const fallback = write
    ? 'requisitions.initiate.initiate-failed-description'
    : 'requisitions.initiate.load-failed-description';
  return failure.kind === 'server' || failure.kind === 'request'
    ? requisitionFailureText(failure, fallback, t)
    : t(fallback);
}
