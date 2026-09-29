import { onlineManager } from '@tanstack/react-query';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OfflineNotice, useOfflineFailure } from '@/components/offline-notice';
import { httpError, networkError } from '@/tests/http-error';

describe('useOfflineFailure', () => {
  it('counts a request that got no answer, not a bug that happens while offline', () => {
    expect(renderHook(() => useOfflineFailure(networkError(), vi.fn())).result.current).toBe(true);
    expect(renderHook(() => useOfflineFailure(httpError(500), vi.fn())).result.current).toBe(false);

    onlineManager.setOnline(false);
    const bug = new TypeError('Cannot read properties of undefined');
    expect(renderHook(() => useOfflineFailure(bug, vi.fn())).result.current).toBe(false);
  });

  it('tries again once the connection is back, for an offline failure only', () => {
    const offlineRetry = vi.fn();
    const otherRetry = vi.fn();
    onlineManager.setOnline(false);
    renderHook(() => useOfflineFailure(networkError(), offlineRetry));
    renderHook(() => useOfflineFailure(httpError(500), otherRetry));

    act(() => onlineManager.setOnline(true));

    expect(offlineRetry).toHaveBeenCalledOnce();
    expect(otherRetry).not.toHaveBeenCalled();
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
