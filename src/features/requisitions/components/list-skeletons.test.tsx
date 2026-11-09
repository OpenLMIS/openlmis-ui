import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { expect, it, vi } from 'vitest';
import { ApprovalTableSkeleton } from '@/features/requisitions/components/approval-table';
import { ConvertTableSkeleton } from '@/features/requisitions/components/convert-table';

vi.mock('@/features/reference-data/api/api', async (original) => ({
  ...(await original<object>()),
  fetchCurrencySettings: () => new Promise(() => {}),
}));

it.each([
  ['Approve', ApprovalTableSkeleton],
  ['Convert', ConvertTableSkeleton],
] as const)('renders the %s skeleton without waiting for date settings', (_name, Skeleton) => {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <Suspense fallback={<p>Waiting for date settings</p>}>
        <Skeleton cards={false} columns={{}} search={{}} />
      </Suspense>
    </QueryClientProvider>,
  );
  expect(screen.queryByText('Waiting for date settings')).not.toBeInTheDocument();
  expect(screen.getByRole('table')).toBeInTheDocument();
  client.clear();
});
