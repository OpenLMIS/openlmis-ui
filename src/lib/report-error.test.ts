import { onlineManager } from '@tanstack/react-query';
import { AxiosHeaders } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { reportApiError, reportCaughtError } from '@/lib/report-error';
import { httpError, networkError } from '@/test-utils/http-error';

describe('reportCaughtError', () => {
  it('logs an error a boundary caught, with where it happened', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    reportCaughtError(httpError(500), { componentStack: '\n    at Widget' });

    expect(log).toHaveBeenCalledWith(httpError(500), '\n    at Widget');
  });

  it('keeps quiet about a request that got no answer, which the page already explains', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    reportCaughtError(networkError(), {});

    expect(log).not.toHaveBeenCalled();
  });

  it('still logs a real bug that happens while offline, but not an app part it could not fetch', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    onlineManager.setOnline(false);

    reportCaughtError(new TypeError('Failed to fetch dynamically imported module: /a.js'), {});
    reportCaughtError(new TypeError('Cannot read properties of undefined'), {});

    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0]?.[0]).toHaveProperty('message', 'Cannot read properties of undefined');
  });
});

it('keeps API failure handling running when diagnostic logging throws', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementationOnce(() => {
    throw new Error('Diagnostic logger unavailable');
  });
  try {
    expect(() => reportApiError(httpError(500))).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
  } finally {
    warn.mockRestore();
  }
});

it('reports each unknown reversal line key once without line details', () => {
  const required = 'stockmanagement.error.event.cancellation.reason.required';
  const invalid = 'stockmanagement.error.event.cancellation.reason.invalid';
  const error = httpError(400, {
    lineErrors: [required, invalid, 'unknown.first', 'unknown.first', 'unknown.second'].map(
      (messageKey) => ({ messageKey, message: 'Private line text', stockEventLineItemId: 'line' }),
    ),
  });
  error.config = {
    headers: new AxiosHeaders(),
    method: 'post',
    url: '/api/stockEvents/reverse?token=secret',
  };
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  reportApiError(error);
  reportApiError(
    httpError(400, { lineErrors: [{ messageKey: required }, { messageKey: invalid }] }),
  );

  expect(warn.mock.calls).toEqual(
    ['unknown.first', 'unknown.second'].map((messageKey) => [
      'API request failed',
      { method: 'POST', path: '/api/stockEvents/reverse', status: 400, messageKey },
    ]),
  );
});
