import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorFallback } from '@/components/error-fallback';
import { httpError, networkError } from '@/tests/http-error';

vi.mock('@/components/no-access-page', () => ({ NoAccessPage: () => <p>no-access</p> }));

const renderFallback = (error: unknown) =>
  render(<ErrorFallback error={error as Error} info={undefined} reset={vi.fn()} />);

describe('ErrorFallback', () => {
  it('asks for a connection when the page could not load offline, blocked loaders included', () => {
    renderFallback(networkError());

    expect(screen.getByRole('heading', { name: 'offline.notice-title' })).toBeInTheDocument();
    expect(screen.queryByText('error.title')).not.toBeInTheDocument();
  });

  it('still says No Access for a refusal', () => {
    renderFallback(httpError(403));

    expect(screen.getByText('no-access')).toBeInTheDocument();
  });
});
