import { onlineManager } from '@tanstack/react-query';
import { createRootRoute, createRouter, RouterContextProvider } from '@tanstack/react-router';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorFallback } from '@/components/error-fallback';
import { Button } from '@/components/ui/button';
import { httpError, networkError } from '@/tests/http-error';

vi.mock('@/components/no-access-page', () => ({ NoAccessPage: () => <p>no-access</p> }));

const invalidate = vi.fn();
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  useRouter: () => ({ invalidate }),
}));

const chunk = vi.hoisted(() => ({ reloadOnce: vi.fn() }));
vi.mock('@/lib/chunk-load', async (original) => ({
  ...(await original<typeof import('@/lib/chunk-load')>()),
  reloadOnce: chunk.reloadOnce,
}));

const missingChunk = () =>
  new TypeError('Failed to fetch dynamically imported module: /v2/assets/route-old.js');

const reset = vi.fn();
const renderFallback = (error: unknown) =>
  render(<ErrorFallback error={error as Error} info={undefined} reset={reset} />);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  onlineManager.setOnline(true);
});

describe('ErrorFallback', () => {
  it.each([true, false])('shows error details only in development (DEV=%s)', (development) => {
    vi.stubEnv('DEV', development);
    const error = new TypeError('Internal failure');
    error.stack = 'TypeError: Internal failure\n    at loader';
    const { container } = render(
      <ErrorFallback back={<Button>Back</Button>} error={error} info={undefined} reset={reset} />,
    );

    if (development) {
      expect(screen.getByText('TypeError: Internal failure')).toBeInTheDocument();
      expect(container.querySelector('pre')).toHaveTextContent('at loader');
      expect(container.querySelector('pre')?.parentElement).toHaveAttribute('dir', 'ltr');
    } else {
      expect(screen.queryByText('TypeError: Internal failure')).not.toBeInTheDocument();
      expect(container.querySelector('pre')).not.toBeInTheDocument();
    }
  });

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

  it('still says No Access for a refusal', () => {
    renderFallback(httpError(403));

    expect(screen.getByText('no-access')).toBeInTheDocument();
  });

  it("names the page's own failure as its heading, and runs the loaders before it resets", async () => {
    const steps: string[] = [];
    const back = vi.fn();
    invalidate.mockImplementation(() => steps.push('invalidate'));
    render(
      <RouterContextProvider router={createRouter({ routeTree: createRootRoute() })}>
        <ErrorFallback
          back={<Button onClick={back}>Back To List</Button>}
          description="Could not load this page."
          error={new Error('boom')}
          info={undefined}
          reset={() => steps.push('reset')}
          title="Page Not Loaded"
        />
      </RouterContextProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Page Not Loaded' })).toBeInTheDocument();
    expect(screen.getByText('Could not load this page.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'error.try-again' }));

    expect(steps).toEqual(['invalidate', 'reset']);
    expect(screen.queryByRole('link', { name: 'not-found.back-home' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back To List' }));
    expect(back).toHaveBeenCalledOnce();
  });
});

it('reseeds connection on retry after Continue Offline', async () => {
  onlineManager.setOnline(false);
  renderFallback(networkError());
  await userEvent.click(screen.getByRole('button', { name: 'error.try-again' }));
  expect(onlineManager.isOnline()).toBe(true);
});

describe('a page that fails while offline', () => {
  it.each([
    ['a part of the app this device lacks', missingChunk()],
    ['any other failure', new TypeError('Cannot read properties of undefined')],
  ])('says it is not available offline for %s, and retries on reconnect', (_, error) => {
    onlineManager.setOnline(false);
    renderFallback(error);

    expect(screen.getByRole('heading', { name: 'offline.unavailable-title' })).toBeInTheDocument();
    expect(screen.queryByText('error.title')).not.toBeInTheDocument();

    act(() => onlineManager.setOnline(true));

    if (error.message.includes('dynamically')) expect(chunk.reloadOnce).toHaveBeenCalledOnce();
    else expect(reset).toHaveBeenCalledOnce();
  });
});

it('reloads into the current version when an app part is missing online', () => {
  render(
    <ErrorFallback
      back={<Button>Back</Button>}
      error={missingChunk()}
      info={undefined}
      reset={reset}
    />,
  );

  expect(chunk.reloadOnce).toHaveBeenCalledOnce();
});
