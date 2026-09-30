import { onlineManager } from '@tanstack/react-query';
import { act, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFormatPercent, WidgetError } from '@/features/home/components/dashboard-parts';
import { httpError, networkError } from '@/tests/http-error';

describe('WidgetError', () => {
  it('asks for a connection offline, quietly, and fills in once it is back', () => {
    const onRetry = vi.fn();
    onlineManager.setOnline(false);
    render(<WidgetError error={networkError()} onRetry={onRetry} />);

    expect(screen.getByRole('status')).toHaveTextContent('offline.notice-title');
    act(() => onlineManager.setOnline(true));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('says the widget could not load for any other failure', () => {
    render(<WidgetError error={httpError(500)} onRetry={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('home.load-error');
  });
});

describe('useFormatPercent', () => {
  it('writes a share as a whole percent', () => {
    const { result } = renderHook(() => useFormatPercent());

    expect(result.current(9 / 21)).toBe('43%');
    expect(result.current(0)).toBe('0%');
  });
});
