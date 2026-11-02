import { queryOptions } from '@tanstack/react-query';
import { fetchOrder, fetchOrderStockOnHand } from '@/features/orders/api/api';
import { commonNodeIds, supplierIds } from '@/features/orders/lib/supplying-facilities';
import {
  facilitySupervisoryNodesOptions,
  supplyLinesOptions,
} from '@/features/reference-data/api/queries';
import { queryKeys } from '@/lib/key-factory';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export const supplyingFacilitiesOptions = (programId: string, facilityIds: readonly string[]) =>
  queryOptions({
    queryKey: [...queryKeys.orders.all, 'suppliers', programId, facilityIds.toSorted()],
    queryFn: async ({ client }) => {
      const scope = getSessionScope();
      const nodes = await Promise.all(
        facilityIds.map((facilityId) =>
          client.fetchQuery(facilitySupervisoryNodesOptions({ programId, facilityId })),
        ),
      );
      assertSessionScope(scope);
      const lines = await Promise.all(
        commonNodeIds(nodes).map((supervisoryNodeId) =>
          client.fetchQuery(supplyLinesOptions({ programId, supervisoryNodeId })),
        ),
      );
      assertSessionScope(scope);
      return supplierIds(lines.flat());
    },
  });

export const orderOptions = (id: string) =>
  queryOptions({ queryKey: queryKeys.orders.detail(id), queryFn: () => fetchOrder(id) });
export const orderStockOnHandOptions = (filter: {
  programId: string;
  facilityId: string;
  orderableIds: readonly string[];
}) =>
  queryOptions({
    queryKey: [
      ...queryKeys.stockCardSummaries.all,
      'orders',
      { ...filter, orderableIds: filter.orderableIds.toSorted() },
    ],
    queryFn: () => fetchOrderStockOnHand(filter),
  });
