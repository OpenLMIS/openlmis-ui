import { QueryClient } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { requirePermissions } from '@/features/auth/lib/access';
import { facilityCceOptions } from '@/features/cce-inventory/api/queries';
import { createShipmentDraftOnce } from '@/features/orders/api/api';
import { orderOptions, shipmentDraftOptions, shipmentOptions } from '@/features/orders/api/queries';
import { parsePermissions } from '@/lib/permissions';
import { Route } from '@/routes/(protected)/_protected.orders.fulfillment_.$orderId';
import { creatingOrder } from '@/test-utils/order-fixtures';

vi.mock('@/features/auth/lib/access', () => ({ requirePermissions: vi.fn() }));
vi.mock('@/features/orders/api/api', async (original) => ({
  ...(await original<typeof import('@/features/orders/api/api')>()),
  createShipmentDraftOnce: vi.fn(),
}));
it.each(['ORDERED', 'FULFILLING', 'CANCELLED', 'SHIPPED'])(
  'reads %s fresh on entry, prefetches the matching record and never creates during loading',
  async (status) => {
    const client = new QueryClient();
    const rights = Promise.withResolvers<ReturnType<typeof parsePermissions>>();
    const freshOrder = Promise.withResolvers<ReturnType<typeof creatingOrder>>();
    vi.mocked(requirePermissions).mockReturnValue(rights.promise);
    const fetch = vi.spyOn(client, 'fetchQuery').mockReturnValue(freshOrder.promise);
    const prefetch = vi.spyOn(client, 'prefetchQuery').mockResolvedValue();
    const loader = Route.options.loader;
    if (typeof loader !== 'function') throw new Error('Expected shipment loader');
    const loading = loader({
      context: { queryClient: client },
      params: { orderId: 'a' },
      cause: 'enter',
    } as Parameters<typeof loader>[0]);
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: orderOptions('a').queryKey, staleTime: 0 }),
    );
    expect(requirePermissions).toHaveBeenCalledWith(client, [
      'SHIPMENTS_VIEW',
      'SHIPMENTS_EDIT',
      'ORDERS_VIEW',
    ]);
    freshOrder.resolve({ ...creatingOrder(), status });
    rights.resolve(parsePermissions(['SHIPMENTS_EDIT|supplier', 'ORDERS_EDIT|elsewhere']));
    const loaded = await loading;
    const editable = ['ORDERED', 'FULFILLING'].includes(status);
    expect(prefetch).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: (editable ? shipmentDraftOptions('a') : shipmentOptions('a')).queryKey,
        staleTime: 0,
      }),
    );
    expect(
      prefetch.mock.calls.some(
        ([options]) =>
          options.queryKey[0] === 'orders' &&
          options.queryKey[1] === (editable ? 'shipment' : 'shipment-draft'),
      ),
    ).toBe(false);
    expect(prefetch.mock.calls.some(([options]) => options.queryKey.includes('facility-cce'))).toBe(
      false,
    );
    expect(loaded.access).toEqual({ canEdit: true, canCancel: false, canPrint: false });
    expect(createShipmentDraftOnce).not.toHaveBeenCalled();
    expect(Route.options.preload).toBe(false);
  },
);

it.each([
  ['facility-a', true],
  ['another-facility', false],
] as const)('uses CCE supervision grants at %s: %s', async (facility, expected) => {
  const client = new QueryClient();
  vi.mocked(requirePermissions).mockResolvedValue(
    parsePermissions(['SHIPMENTS_EDIT|supplier', `CCE_INVENTORY_VIEW|${facility}|another-program`]),
  );
  vi.spyOn(client, 'fetchQuery').mockResolvedValue(creatingOrder());
  const prefetch = vi.spyOn(client, 'prefetchQuery').mockResolvedValue();
  const loader = Route.options.loader;
  if (typeof loader !== 'function') throw new Error('Expected shipment loader');
  const loaded = await loader({
    context: { queryClient: client },
    params: { orderId: 'a' },
    cause: 'enter',
  } as Parameters<typeof loader>[0]);
  expect(loaded.canViewCce).toBe(expected);
  const cceKey = facilityCceOptions('facility-a').queryKey;
  expect(
    prefetch.mock.calls.some(
      ([options]) => JSON.stringify(options.queryKey) === JSON.stringify(cceKey),
    ),
  ).toBe(expected);
});
