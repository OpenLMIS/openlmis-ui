import { queryOptions } from '@tanstack/react-query';
import {
  fetchEligibleInventoryProducts,
  fetchInventoryStockLines,
  fetchInventorySummaries,
  fetchPhysicalInventoryDraft,
} from '@/features/stock-events/api/physical-inventory-api';
import type {
  InventoryScope,
  PhysicalInventoryDraft,
} from '@/features/stock-events/lib/physical-inventory-types';
import { queryKeys } from '@/lib/key-factory';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export const physicalInventoryDraftOptions = (scope: InventoryScope) =>
  queryOptions({
    queryKey: queryKeys.physicalInventories.list(scope),
    queryFn: () => fetchPhysicalInventoryDraft(scope),
  });

export const inventorySummariesOptions = ({ programId, facilityId }: InventoryScope) =>
  queryOptions({
    queryKey: queryKeys.physicalInventories.list({ programId, facilityId, summaries: true }),
    queryFn: () => fetchInventorySummaries({ programId, facilityId }),
    staleTime: Infinity,
  });

export const inventoryStockLinesOptions = (draft: PhysicalInventoryDraft) =>
  queryOptions({
    queryKey: [...queryKeys.physicalInventories.detail(draft.id), 'stock-lines', draft.lineItems],
    queryFn: async ({ client }) => {
      const session = getSessionScope();
      const summaries = await client.fetchQuery(inventorySummariesOptions(draft));
      assertSessionScope(session);
      return fetchInventoryStockLines(draft.lineItems, summaries);
    },
  });

export const eligibleInventoryProductsOptions = ({ programId, facilityId }: InventoryScope) =>
  queryOptions({
    queryKey: queryKeys.physicalInventories.list({ programId, facilityId, eligible: true }),
    queryFn: async ({ client }) => {
      const session = getSessionScope();
      const summaries = await client.fetchQuery(
        inventorySummariesOptions({ programId, facilityId }),
      );
      assertSessionScope(session);
      return fetchEligibleInventoryProducts(summaries);
    },
    staleTime: 5 * 60_000,
  });
