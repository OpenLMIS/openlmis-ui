import { expect, it } from 'vitest';
import { toRequisitionFailure } from '@/features/requisitions/lib/failure';
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
