import { parseDateValue, toDateValue } from '@/components/form/date-value';
import { ORDER_NUMBER_MESSAGES } from '@/features/orders/lib/order-numbers';
import type { PodFooter, PodLineDraft } from '@/features/orders/lib/pod-types';
import { toWholeNumber, wholeNumberError } from '@/lib/whole-number';
export const POD_ERRORS = {
  required: ORDER_NUMBER_MESSAGES.required,
  invalid: ORDER_NUMBER_MESSAGES.invalid,
  tooLarge: ORDER_NUMBER_MESSAGES.tooLarge,
  aboveShipped: 'orders.pod.can-not-accept-more-than-shipped',
  reasonRequired: ORDER_NUMBER_MESSAGES.required,
  reasonNotAllowed: 'orders.pod.can-not-specify-reason-for-rejection-if-not-rejecting-anything',
  vvmRequired: 'orders.pod.vvm-status-is-required',
  vvmNotAllowed: 'orders.pod.cannot-select-vvm-status-when-nothing-accepted',
  futureDate: 'orders.pod.received-date-in-future',
  invalidDate: 'orders.pod.invalid-date',
  noShipment: 'orders.pod.no-shipped-quantity',
} as const;
export type PodError = (typeof POD_ERRORS)[keyof typeof POD_ERRORS];
export type PodValidationMode = 'save' | 'confirm';
export function acceptedFormatError(value: string) {
  return wholeNumberError(value, ORDER_NUMBER_MESSAGES, { optional: true });
}
export function returnedQuantity(shipped: number, accepted: string) {
  const quantity = toWholeNumber(accepted);
  return accepted.trim() && Number.isFinite(quantity)
    ? Math.max(0, Math.min(shipped, shipped - quantity))
    : 0;
}
export function podAutoClear(accepted: string, shipped: number | null) {
  const valid = Boolean(accepted.trim()) && !acceptedFormatError(accepted);
  return {
    reason: valid && shipped !== null && returnedQuantity(shipped, accepted) === 0,
    vvm: valid && toWholeNumber(accepted) === 0,
  };
}
export function validatePodLine(
  line: PodLineDraft,
  source: { quantityShipped: number | null; useVvm: boolean },
  mode: PodValidationMode,
): Partial<Record<keyof PodLineDraft, PodError>> {
  const errors: Partial<Record<keyof PodLineDraft, PodError>> = {};
  if (source.quantityShipped === null)
    return mode === 'confirm' && !line.accepted.trim()
      ? { accepted: POD_ERRORS.noShipment }
      : errors;
  const format = acceptedFormatError(line.accepted);
  if (format) return { accepted: format };
  if (mode === 'save') return errors;
  const hasAccepted = Boolean(line.accepted.trim());
  if (!hasAccepted) errors.accepted = POD_ERRORS.required;
  const accepted = toWholeNumber(line.accepted);
  if (accepted > source.quantityShipped) errors.accepted = POD_ERRORS.aboveShipped;
  const returned = returnedQuantity(source.quantityShipped, line.accepted);
  if (returned > 0 && !line.reason) errors.reason = POD_ERRORS.reasonRequired;
  if (returned === 0 && line.reason) errors.reason = POD_ERRORS.reasonNotAllowed;
  if (source.useVvm && accepted > 0 && !['STAGE_1', 'STAGE_2'].includes(line.vvm))
    errors.vvm = POD_ERRORS.vvmRequired;
  if (hasAccepted && accepted === 0 && line.vvm) errors.vvm = POD_ERRORS.vvmNotAllowed;
  return errors;
}
export function validatePodFooter(
  fields: PodFooter,
  mode: PodValidationMode,
  timeZone: string,
  now = new Date(),
): Partial<Record<keyof PodFooter, PodError>> {
  const errors: Partial<Record<keyof PodFooter, PodError>> = {};
  if (mode === 'confirm')
    for (const key of ['receivedBy', 'deliveredBy', 'receivedDate'] as const)
      if (!fields[key].trim()) errors[key] = POD_ERRORS.required;
  if (fields.receivedDate) {
    if (!parseDateValue(fields.receivedDate)) errors.receivedDate = POD_ERRORS.invalidDate;
    else if (fields.receivedDate > toDateValue(now, timeZone))
      errors.receivedDate = POD_ERRORS.futureDate;
  }
  return errors;
}
