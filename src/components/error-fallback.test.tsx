import { createRootRoute, createRouter, RouterContextProvider } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorFallback } from '@/components/error-fallback';
import { httpError, networkError } from '@/tests/http-error';

vi.mock('@/components/no-access-page', () => ({ NoAccessPage: () => <p>no-access</p> }));

const invalidate = vi.fn();
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  useRouter: () => ({ invalidate }),
}));

const reset = vi.fn();
const renderFallback = (error: unknown) =>
  render(<ErrorFallback error={error as Error} info={undefined} reset={reset} />);

describe('ErrorFallback', () => {
  it('asks for a connection when the page could not load offline, blocked loaders included', () => {
    renderFallback(networkError());

    expect(screen.getByRole('heading', { name: 'offline.notice-title' })).toBeInTheDocument();
    expect(screen.queryByText('error.title')).not.toBeInTheDocument();
  });

  it('runs the page loaders again on retry, since a failed loader is what put it here', async () => {
    renderFallback(networkError());

    await userEvent.click(screen.getByRole('button', { name: 'error.try-again' }));

    expect(invalidate).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledOnce();
  });

  it('runs the loaders again for any other error too, so its Try Again works', async () => {
    invalidate.mockClear();
    reset.mockClear();
    render(
      <RouterContextProvider router={createRouter({ routeTree: createRootRoute() })}>
        <ErrorFallback error={new Error('boom')} info={undefined} reset={reset} />
      </RouterContextProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'error.try-again' }));

    expect(invalidate).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledOnce();
  });

  it('still says No Access for a refusal', () => {
    renderFallback(httpError(403));

    expect(screen.getByText('no-access')).toBeInTheDocument();
  });
});
