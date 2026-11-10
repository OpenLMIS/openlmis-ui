import { QueryClient } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { Suspense } from 'react';
import { expect, it, vi } from 'vitest';
import { ordersSearchOptions } from '@/features/orders/api/queries';
import { OrdersTable, OrdersTableSkeleton } from '@/features/orders/components/orders-table';
import { toOrderParams } from '@/features/orders/lib/order-search';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { orderSummary } from '@/test-utils/order-fixtures';
import { renderPage } from '@/test-utils/render-page';

it('renders Fulfill results without Actions when legacy is unavailable', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
  client.setQueryData(ordersSearchOptions(toOrderParams({}, 'fulfill')).queryKey, {
    content: [{ ...orderSummary('a'), status: 'ORDERED', orderCode: 'ORDER-A' }],
    totalElements: 1,
    totalPages: 1,
    number: 0,
    size: 10,
  });
  renderPage(
    <OrdersTable
      kind="fulfill"
      legacyAvailable={false}
      cards={false}
      columns={{}}
      search={{}}
      onSearchChange={vi.fn()}
    />,
    { queryClient: client },
  );
  expect(await screen.findByText('ORDER-A')).toBeVisible();
  expect(screen.queryByRole('columnheader', { name: /actions/i })).not.toBeInTheDocument();
});

it('renders the loading table while the deployment time zone is pending', async () => {
  const client = new QueryClient();
  const options = deploymentTimeZoneOptions();
  void client.fetchQuery({
    ...options,
    queryFn: () => new Promise<{ zone: string; read: boolean }>(() => {}),
  });
  renderPage(
    <Suspense fallback={<p>Escaped loading boundary</p>}>
      <OrdersTableSkeleton kind="fulfill" cards={false} columns={{}} search={{}} />
    </Suspense>,
    { queryClient: client },
  );
  expect(
    await screen.findByRole('columnheader', { name: 'orders.fulfill.columns.order-code' }),
  ).toBeVisible();
  expect(screen.queryByText('Escaped loading boundary')).not.toBeInTheDocument();
  expect(client.getQueryState(options.queryKey)?.status).toBe('pending');
});

it('treats POD picker selections as the search rather than clearable table filters', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  const search = { programId: 'program', requestingFacilityId: 'clinic' };
  client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
  client.setQueryData(ordersSearchOptions(toOrderParams(search, 'pod')).queryKey, {
    content: [],
    totalElements: 0,
    totalPages: 0,
    number: 0,
    size: 10,
  });
  renderPage(
    <OrdersTable kind="pod" cards={false} columns={{}} search={search} onSearchChange={vi.fn()} />,
    { queryClient: client },
  );
  expect(await screen.findByText('orders.pod.empty-title')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'data-table.clear-filters' }),
  ).not.toBeInTheDocument();
});
