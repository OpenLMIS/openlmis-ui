import { expect, it } from 'vitest';
import { requisitionFailureText, toRequisitionFailure } from '@/features/requisitions/lib/failure';
import { httpError } from '@/test-utils/http-error';

it('treats the live versionMismatch message as a conflict, keeping the local copy', () => {
  expect(
    toRequisitionFailure(
      httpError(409, {
        messageKey: 'requisition.error.validation.versionMismatch',
        message:
          'This requisition has a newer version on the server and therefore the current version cannot be saved; the server version will be used, and you will need to remake your changes.',
      }),
    ),
  ).toEqual({ kind: 'conflict' });
});
it('recognizes reused keys only by the exact server message key', () => {
  expect(
    toRequisitionFailure(
      httpError(409, {
        messageKey: 'requisition.error.validation.idempotencyKey.alreadyUsed',
        message: 'Translated text',
      }),
    ),
  ).toEqual({ kind: 'key-used' });
  expect(toRequisitionFailure(httpError(409, { message: 'key already used' }))).toEqual({
    kind: 'conflict',
  });
});

it('keeps server text from both legacy field-map formats', () => {
  const failure = toRequisitionFailure(
    httpError(400, {
      requestedQuantity: { message: 'Requested quantity is required.' },
      stockOnHand: 'Stock on hand is required.',
    }),
  );
  expect(failure.kind).toBe('request');
  if (failure.kind !== 'request') return;
  expect(requisitionFailureText(failure, 'error.description', (key) => key)).toBe(
    'Requested quantity is required.\nStock on hand is required.',
  );
});

it('gives Create Authorize its own reused-key recovery without an absent Update action', async () => {
  const { initiateFailureMessage } = await import('./initiate-failure');
  expect(
    initiateFailureMessage(
      httpError(409, { messageKey: 'requisition.error.validation.idempotencyKey.alreadyUsed' }),
      (key) => key,
    ),
  ).toBe('requisitions.initiate.error.key-used');
});
