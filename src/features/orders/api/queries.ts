import { queryOptions } from '@tanstack/react-query';
import { commonNodeIds, supplierIds } from '@/features/orders/lib/supplying-facilities';
import {
  facilitySupervisoryNodesOptions,
  supplyLinesOptions,
} from '@/features/reference-data/api/queries';
import { queryKeys } from '@/lib/key-factory';

export const supplyingFacilitiesOptions = (programId: string, facilityIds: readonly string[]) =>
  queryOptions({
    queryKey: [...queryKeys.orders.all, 'suppliers', programId, facilityIds.toSorted()],
    queryFn: async ({ client }) => {
      const nodes = await Promise.all(
        facilityIds.map((facilityId) =>
          client.fetchQuery(facilitySupervisoryNodesOptions({ programId, facilityId })),
        ),
      );
      const lines = await Promise.all(
        commonNodeIds(nodes).map((supervisoryNodeId) =>
          client.fetchQuery(supplyLinesOptions({ programId, supervisoryNodeId })),
        ),
      );
      return supplierIds(lines.flat());
    },
  });
