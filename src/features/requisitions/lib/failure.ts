import { isAxiosError } from 'axios';
import { serverMessage } from '@/components/dialog-parts';

export class RequisitionRetryConflict extends Error {}
export type RequisitionFailure =
  | { kind: 'server'; message?: string }
  | { kind: 'forbidden' }
  | { kind: 'conflict' }
  | { kind: 'key-used' };

export function toRequisitionFailure(error: unknown): RequisitionFailure {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  if (status === 409) {
    const keyUsed = /key.*(already|used)|already.*key/i.test(
      JSON.stringify(isAxiosError(error) ? error.response?.data : ''),
    );
    return { kind: keyUsed ? 'key-used' : 'conflict' };
  }
  if (error instanceof RequisitionRetryConflict) return { kind: 'conflict' };
  if (status === 403) return { kind: 'forbidden' };
  const fields =
    status === 400 && isAxiosError(error)
      ? Object.values(error.response?.data ?? {})
          .flatMap((value) =>
            value &&
            typeof value === 'object' &&
            'message' in value &&
            typeof value.message === 'string'
              ? [value.message]
              : [],
          )
          .join('\n')
      : '';
  return { kind: 'server', message: serverMessage(error) || fields || undefined };
}
