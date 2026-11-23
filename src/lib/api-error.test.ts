import { AxiosError, AxiosHeaders } from 'axios';
import i18n from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import { apiErrorText, fieldErrorFor } from '@/lib/api-error';
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

const fallback = 'users.form.save-error';
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
      false,
      'Enter a valid email address.',
    ],
    [
      'unknown key',
      httpError(400, { messageKey: 'example.key', message: 'Server explanation' }),
      false,
      'Server explanation',
    ],
    ['unkeyed body', httpError(500, { message: 'Internal exception' }), false, t(fallback)],
    [
      'auth technical key',
      httpError(400, { messageKey: 'error.sendRequest', message: 'Upstream exception' }),
      false,
      t(fallback),
    ],
    [
      'CCE technical key',
      httpError(400, { messageKey: 'cce.error.io', message: 'I/O exception' }),
      true,
      t(fallback),
    ],
    ['offline', networkError(), false, t('error.check-connection')],
    ['gateway', httpError(502, '<html>gateway error</html>'), false, t('error.check-connection')],
    [
      'read timeout',
      new AxiosError('Timeout', 'ECONNABORTED'),
      false,
      'The server took too long to answer. Try again.',
    ],
    [
      'write timeout',
      new AxiosError('Timeout', 'ETIMEDOUT'),
      true,
      'The server did not answer in time. The change may have been saved. Reload before trying again.',
    ],
    ['cancelled', new AxiosError('Cancelled', 'ERR_CANCELED'), false, null],
    ['session ended', new SessionEndedError(), false, null],
    ['session 401', httpError(401), false, null],
    ['sessionless 401', sessionless, false, t(fallback)],
  ] as const)('resolves %s', (_, error, write, expected) => {
    expect(apiErrorText(error, fallback, t, { write })).toBe(expected);
  });

  it('matches only mapped field errors', () => {
    const code = { field: 'code', key: 'facilities.form.code-taken' } as const;
    const table = { 'referenceData.error.facility.code.mustBeUnique': code };
    expect(fieldErrorFor(httpError(400, { messageKey: Object.keys(table)[0] }), table)).toBe(code);
    expect(fieldErrorFor(httpError(400, { messageKey: 'other' }), table)).toBeUndefined();
    expect(
      fieldErrorFor(httpError(401, { messageKey: Object.keys(table)[0] }), table),
    ).toBeUndefined();
    expect(fieldErrorFor(new Error('offline'), table)).toBeUndefined();
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
      reportApiError(networkError());
      reportApiError(new AxiosError('Cancelled', 'ERR_CANCELED'));
      expect(warn.mock.calls).toEqual([
        [
          'API request failed',
          { method: 'POST', path: '/api/users', status: 400, messageKey: 'unknown.key' },
        ],
      ]);
    } finally {
      warn.mockRestore();
    }
  });
});
