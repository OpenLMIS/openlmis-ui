import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListError } from '@/components/app-shell/list-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { httpError, networkError } from '@/test-utils/http-error';

vi.mock('@/components/app-shell/no-access-page', () => ({ NoAccess: () => <p>no-access</p> }));

const renderError = (error: unknown) =>
  render(<ListError description="list.error" error={error} reset={vi.fn()} title="list.title" />);

describe('ListError', () => {
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

  it('retries a missing device download automatically when the connection returns', async () => {
    onlineManager.setOnline(false);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, networkMode: 'always' } },
    });
    function Stock() {
      const { data } = useSuspenseQuery({
        queryKey: ['stock'],
        queryFn: async () => {
          if (!onlineManager.isOnline()) throw new LocalDataUnavailableError();
          return 'Loaded stock';
        },
      });
      return data;
    }
    render(
      <QueryClientProvider client={client}>
        <QueryBoundary
          resetKey="stock"
          pendingFallback="Loading"
          errorComponent={({ error, reset }) => (
            <ListError error={error} reset={reset} title="Error" description="Failed" />
          )}
        >
          <Stock />
        </QueryBoundary>
      </QueryClientProvider>,
      { onCaughtError: () => {} },
    );
    expect(await screen.findByText('offline.unavailable-title')).toBeInTheDocument();
    act(() => onlineManager.setOnline(true));
    expect(await screen.findByText('Loaded stock')).toBeInTheDocument();
  });
});
