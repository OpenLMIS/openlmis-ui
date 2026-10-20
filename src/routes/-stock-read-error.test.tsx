import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { QueryBoundary } from '@/components/query-boundary';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { StockReadError } from '@/routes/-stock-read-error';

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
          <StockReadError error={error} reset={reset} title="Error" description="Failed" />
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
