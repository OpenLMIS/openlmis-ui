import { onlineManager } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoadError } from '@/components/load-error';
import { httpError, networkError } from '@/tests/http-error';

describe('LoadError', () => {
  it('asks for a connection offline, and loads again once it is back', () => {
    const reset = vi.fn();
    onlineManager.setOnline(false);
    render(
      <LoadError
        description="load.error"
        error={networkError()}
        reset={reset}
        title="load.title"
      />,
    );

    expect(screen.getByText('offline.notice-title')).toBeInTheDocument();
    expect(screen.queryByText('load.title')).not.toBeInTheDocument();
    act(() => onlineManager.setOnline(true));

    expect(reset).toHaveBeenCalledOnce();
  });

  it('shows its own message for anything else', () => {
    render(
      <LoadError
        description="load.error"
        error={httpError(500)}
        reset={vi.fn()}
        title="load.title"
      />,
    );

    expect(screen.getByText('load.title')).toBeInTheDocument();
    expect(screen.getByText('load.error')).toBeInTheDocument();
  });
});
