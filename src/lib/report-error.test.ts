import { onlineManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportCaughtError } from '@/lib/report-error';
import { httpError, networkError } from '@/tests/http-error';

afterEach(() => onlineManager.setOnline(true));

describe('reportCaughtError', () => {
  it('logs an error a boundary caught', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    reportCaughtError(httpError(500));

    expect(log).toHaveBeenCalledOnce();
  });

  it('keeps quiet about a missing connection, which the page already explains', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    reportCaughtError(networkError());
    onlineManager.setOnline(false);
    reportCaughtError(httpError(500));

    expect(log).not.toHaveBeenCalled();
  });
});
