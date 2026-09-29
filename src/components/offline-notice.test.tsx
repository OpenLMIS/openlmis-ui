import { onlineManager } from '@tanstack/react-query';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ListError } from '@/components/list-error';
import {
  OfflineNotice,
  useIsOfflineFailure,
  useRetryWhenOnline,
} from '@/components/offline-notice';
import { httpError, networkError } from '@/tests/http-error';

vi.mock('@/components/no-access-page', () => ({ NoAccess: () => <p>no-access</p> }));

afterEach(() => onlineManager.setOnline(true));

describe('useIsOfflineFailure', () => {
  it('counts a request that got no answer, or any failure while offline', () => {
    expect(renderHook(() => useIsOfflineFailure(networkError())).result.current).toBe(true);
    expect(renderHook(() => useIsOfflineFailure(httpError(500))).result.current).toBe(false);

    onlineManager.setOnline(false);
    expect(renderHook(() => useIsOfflineFailure(httpError(500))).result.current).toBe(true);
  });
});

describe('useRetryWhenOnline', () => {
  it('tries again once the connection is back, and only then', () => {
    const retry = vi.fn();
    onlineManager.setOnline(false);
    renderHook(() => useRetryWhenOnline(retry));
    expect(retry).not.toHaveBeenCalled();

    act(() => onlineManager.setOnline(true));

    expect(retry).toHaveBeenCalledOnce();
  });
});

describe('OfflineNotice', () => {
  it('says the data needs a connection and lets the user try again', async () => {
    const onRetry = vi.fn();
    render(<OfflineNotice onRetry={onRetry} />);

    expect(screen.getByRole('heading', { name: 'offline.notice-title' })).toBeInTheDocument();
    expect(screen.getByText('offline.notice-description')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'error.try-again' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('ListError', () => {
  const renderError = (error: unknown) =>
    render(<ListError description="list.error" error={error} reset={vi.fn()} title="list.title" />);

  it('asks for a connection when the list could not be fetched offline', () => {
    renderError(networkError());

    expect(screen.getByText('offline.notice-title')).toBeInTheDocument();
    expect(screen.queryByText('list.title')).not.toBeInTheDocument();
  });

  it('keeps the list error for anything else', () => {
    renderError(httpError(500));

    expect(screen.getByText('list.title')).toBeInTheDocument();
    expect(screen.getByText('list.error')).toBeInTheDocument();
  });

  it('says No Access when the server refuses', () => {
    renderError(httpError(403));

    expect(screen.getByText('no-access')).toBeInTheDocument();
  });
});
