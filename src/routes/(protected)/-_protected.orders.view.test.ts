import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { requirePermissions } from '@/features/auth/lib/access';
import type { ViewOrdersSearch } from '@/features/orders/lib/order-search';
import { minimalFacilitiesOptions } from '@/features/reference-data/api/queries';
import { parsePermissions } from '@/lib/permissions';
import { Route as FulfillRoute } from '@/routes/(protected)/_protected.orders.fulfillment';
import { Route } from '@/routes/(protected)/_protected.orders.view';

vi.mock('@/features/auth/lib/access', () => ({ requirePermissions: vi.fn() }));

const supplier = 'b1b0d686-38ad-4f41-ae8e-f3dba2958397';

function setup() {
  const client = new QueryClient();
  vi.mocked(requirePermissions).mockResolvedValue(parsePermissions([`ORDERS_VIEW|${supplier}`]));
  const prefetch = vi
    .spyOn(client, 'prefetchQuery')
    .mockImplementation((options) =>
      options.queryKey[1] === 'requesting-facilities' ? new Promise(() => {}) : Promise.resolve(),
    );
  const load = (search: ViewOrdersSearch = { supplyingFacilityId: supplier }) => {
    const loader = Route.options.loader;
    if (typeof loader !== 'function') throw new Error('Expected a route loader');
    return loader({
      context: { queryClient: client },
      deps: { search },
    } as Parameters<typeof loader>[0]);
  };
  const orderCalls = () =>
    prefetch.mock.calls.filter(([options]) => options.queryKey[0] === 'orders');
  return { client, load, orderCalls, prefetch };
}

describe('View Orders loader', () => {
  it('starts picker and order reads without waiting for reference data', async () => {
    const { client, load, orderCalls, prefetch } = setup();
    prefetch.mockImplementation(() => new Promise(() => {}));
    const ensure = vi.spyOn(client, 'ensureQueryData');
    await load({});
    expect(orderCalls()).toEqual([]);
    await load();
    expect(ensure).not.toHaveBeenCalled();
    expect(orderCalls().map(([options]) => options.queryKey[1])).toEqual(
      expect.arrayContaining(['requesting-facilities', 'list']),
    );
  });

  it('prefetches requester options but no orders for inverted dates', async () => {
    const { load, orderCalls } = setup();
    await load({
      supplyingFacilityId: supplier,
      periodStart: '2026-02-01',
      periodEnd: '2026-01-01',
    });
    expect(orderCalls().map(([options]) => options.queryKey[1])).toEqual(['requesting-facilities']);
  });
});

it('starts Fulfill Orders without waiting for requester options', async () => {
  const { client, orderCalls, prefetch } = setup();
  prefetch.mockImplementation(() => new Promise(() => {}));
  const ensure = vi
    .spyOn(client, 'ensureQueryData')
    .mockImplementation(() => new Promise(() => {}));
  vi.mocked(requirePermissions).mockResolvedValue(parsePermissions([`SHIPMENTS_VIEW|${supplier}`]));
  const loader = FulfillRoute.options.loader;
  if (typeof loader !== 'function') throw new Error('Expected a route loader');
  await loader({
    context: { queryClient: client },
    deps: { search: {} },
  } as Parameters<typeof loader>[0]);
  expect(orderCalls().map(([options]) => options.queryKey[1])).toEqual(
    expect.arrayContaining(['list', 'requesting-facilities']),
  );
  expect(ensure).not.toHaveBeenCalled();
});

it('refuses a linked facility without a supplier grant', async () => {
  const { client, load, orderCalls } = setup();
  client.setQueryData(minimalFacilitiesOptions().queryKey, [
    { id: supplier, name: 'Supplier', code: 'S', active: true },
  ]);
  vi.mocked(requirePermissions).mockResolvedValue(parsePermissions(['ORDERS_VIEW|another']));
  await load();
  expect(orderCalls()).toEqual([]);
});
