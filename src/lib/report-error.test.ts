import { onlineManager } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { reportCaughtError } from '@/lib/report-error';
import { httpError, networkError } from '@/tests/http-error';

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
