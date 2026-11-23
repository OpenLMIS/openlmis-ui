import { AxiosError, AxiosHeaders } from 'axios';
import i18n from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import { FACILITY_FIELD_ERRORS } from '@/features/facilities/lib/facility-form';
import { FACILITY_TYPE_FIELD_ERRORS } from '@/features/facility-types/lib/facility-type-form';
import { LOT_FIELD_ERRORS } from '@/features/lots/lib/lot-form';
import { SCHEDULE_FIELD_ERRORS } from '@/features/processing-schedules/lib/schedule-form';
import { PRODUCT_FIELD_ERRORS } from '@/features/products/lib/product-form';
import { PROGRAM_FIELD_ERRORS } from '@/features/programs/lib/program-form';
import { templateFieldErrors } from '@/features/requisition-templates/lib/server-errors';
import { requisitionFailureText, toRequisitionFailure } from '@/features/requisitions/lib/failure';
import { USER_FIELD_ERRORS } from '@/features/users/lib/user-form';
import { apiErrorText, apiFieldMessages, fieldErrorFor } from '@/lib/api-error';
import { reportApiError } from '@/lib/report-error';
import { SessionEndedError } from '@/lib/session-scope';
import { httpError, networkError } from '@/test-utils/http-error';
import en from '../../public/locales/en.json';

await i18n.init({
  lng: 'en',
  keySeparator: false,
  nsSeparator: false,
  resources: { en: { translation: en } },
});

const fallback = 'error.description';
const t = i18n.t.bind(i18n);
const sessionless = httpError(401, { message: 'Credentials rejected' });
sessionless.config = { headers: new AxiosHeaders(), session: false };

describe('apiErrorText', () => {
  it.each([
    [
      'known key',
      httpError(400, {
        messageKey: 'notification.error.userContactDetails.email.invalid',
        message: 'Texto do servidor',
      }),
      'Enter a valid email address.',
    ],
    [
      'unknown key',
      httpError(400, { messageKey: 'example.key', message: 'Server explanation' }),
      'Server explanation',
    ],
    ['unkeyed body', httpError(500, { message: 'Internal exception' }), t(fallback)],
    [
      'auth technical key',
      httpError(400, { messageKey: 'error.sendRequest', message: 'Upstream exception' }),
      t(fallback),
    ],
    [
      'CCE technical key',
      httpError(400, { messageKey: 'cce.error.io', message: 'I/O exception' }),
      t(fallback),
    ],
    [
      'Stock Management technical key',
      httpError(400, {
        messageKey: 'stockmanagement.error.authorization.failed',
        message: 'Upstream permission exception',
      }),
      t(fallback),
    ],
    ['offline', networkError(), t('error.check-connection')],
    ['gateway', httpError(502, '<html>gateway error</html>'), t('error.check-connection')],
    [
      'read timeout',
      new AxiosError('Timeout', 'ECONNABORTED', { method: 'get', headers: new AxiosHeaders() }),
      'The server took too long to answer. Try again.',
    ],
    [
      'write timeout',
      new AxiosError('Timeout', 'ETIMEDOUT', { method: 'put', headers: new AxiosHeaders() }),
      'The server did not answer in time. The change may have been saved. Reload before trying again.',
    ],
    ['cancelled', new AxiosError('Cancelled', 'ERR_CANCELED'), null],
    ['session ended', new SessionEndedError(), null],
    ['session 401', httpError(401), null],
    ['sessionless 401', sessionless, t(fallback)],
  ] as const)('resolves %s', (_, error, expected) => {
    expect(apiErrorText(error, fallback, t)).toBe(expected);
  });

  it.each([
    ['referenceData.error.facilityType.code.duplicated', FACILITY_TYPE_FIELD_ERRORS, 'code'],
    ['referenceData.error.facilityType.name.duplicated', FACILITY_TYPE_FIELD_ERRORS, 'name'],
    ['referenceData.error.processingSchedule.code.duplicated', SCHEDULE_FIELD_ERRORS, 'code'],
    ['referenceData.error.processingSchedule.name.duplicated', SCHEDULE_FIELD_ERRORS, 'name'],
    ['referenceData.error.facility.code.mustBeUnique', FACILITY_FIELD_ERRORS, 'code'],
    ['referenceData.error.program.code.duplicated', PROGRAM_FIELD_ERRORS, 'code'],
    ['referenceData.error.orderable.productCode.mustBeUnique', PRODUCT_FIELD_ERRORS, 'productCode'],
    ['referenceData.error.lot.lotCode.mustBeUnique', LOT_FIELD_ERRORS, 'lotCode'],
    ['referenceData.error.user.username.duplicated', USER_FIELD_ERRORS, 'username'],
    ['notification.error.userContactDetails.email.duplicated', USER_FIELD_ERRORS, 'email'],
    ['notification.error.userContactDetails.email.invalid', USER_FIELD_ERRORS, 'email'],
  ] as const)('maps %s to its form field', (messageKey, table, field) => {
    expect(fieldErrorFor<string>(httpError(400, { messageKey }), table)?.field).toBe(field);
  });

  it('ignores unknown or suppressed field errors', () => {
    const messageKey = 'referenceData.error.facility.code.mustBeUnique';
    expect(
      fieldErrorFor(httpError(400, { messageKey: 'other' }), FACILITY_FIELD_ERRORS),
    ).toBeUndefined();
    expect(fieldErrorFor(httpError(401, { messageKey }), FACILITY_FIELD_ERRORS)).toBeUndefined();
    expect(fieldErrorFor(networkError(), FACILITY_FIELD_ERRORS)).toBeUndefined();
  });

  it.each([
    [
      { name: { message: 'Name is required.' } },
      [{ field: 'name', key: undefined, message: 'Name is required.' }],
    ],
    [
      { name: 'Name is required.' },
      [{ field: 'name', key: undefined, message: 'Name is required.' }],
    ],
    [{ message: 'Internal exception', trace: 'Sensitive detail' }, []],
    [{ messageKey: 'error.sendRequest', message: 'Upstream exception' }, []],
  ])('extracts field messages from %j', (body, expected) => {
    expect(apiFieldMessages(httpError(400, body))).toEqual(expected);
  });

  it('reports a non-Axios failure with its original error', () => {
    const error = new Error('Local write failed');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      reportApiError(error);
      expect(log).toHaveBeenCalledExactlyOnceWith(error);
    } finally {
      log.mockRestore();
    }
  });

  it('reports only diagnostic metadata for an unknown failure', () => {
    const error = httpError(400, { messageKey: 'unknown.key', message: 'Sensitive detail' });
    error.config = {
      method: 'post',
      url: 'https://example.org/api/users?token=secret',
      data: { user: 'private' },
      headers: new AxiosHeaders({ Authorization: 'Bearer secret' }),
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      reportApiError(error);
      error.config.url = 'https://[';
      reportApiError(error);
      reportApiError(networkError());
      reportApiError(new AxiosError('Cancelled', 'ERR_CANCELED'));
      expect(warn.mock.calls).toEqual([
        [
          'API request failed',
          { method: 'POST', path: '/api/users', status: 400, messageKey: 'unknown.key' },
        ],
        ['API request failed', { method: 'POST', status: 400, messageKey: 'unknown.key' }],
      ]);
      expect(warn.mock.calls[1]?.[1]).not.toHaveProperty('path');
    } finally {
      warn.mockRestore();
    }
  });
});

it.each([
  [
    'RFC 9457 problem details',
    {
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Internal detail',
      instance: '/api/requisitions',
    },
  ],
  [
    'Spring default error',
    {
      timestamp: '2026-11-23T12:00:00Z',
      status: 400,
      error: 'Bad Request',
      message: 'Internal detail',
      path: '/api/requisitions',
    },
  ],
  ['partial problem details', { instance: '/api/requisitions', programId: 'Internal detail' }],
  ['partial Spring error', { path: '/api/requisitions', programId: 'Internal detail' }],
])('uses the general fallback for %s', (_, body) => {
  const error = httpError(400, body);
  expect(apiErrorText(error, fallback, t)).toBe(t(fallback));
  expect(apiFieldMessages(error)).toEqual([]);
  expect(templateFieldErrors(error, t)).toBeUndefined();
  const failure = toRequisitionFailure(error);
  if (failure.kind !== 'request') throw new Error('Expected a request failure');
  expect(requisitionFailureText(failure, fallback, t)).toBe(t(fallback));
});
