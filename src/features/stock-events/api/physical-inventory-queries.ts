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

export const physicalInventoryDraftOptions = (scope: InventoryScope) =>
  queryOptions({
    queryKey: queryKeys.physicalInventories.list(scope),
    queryFn: () => fetchPhysicalInventoryDraft(scope),
  });

export const inventorySummariesOptions = (scope: InventoryScope) =>
  queryOptions({
    queryKey: queryKeys.physicalInventories.list({ ...scope, summaries: true }),
    queryFn: () => fetchInventorySummaries(scope),
    staleTime: Infinity,
  });

export const inventoryStockLinesOptions = (draft: PhysicalInventoryDraft) =>
  queryOptions({
    queryKey: [...queryKeys.physicalInventories.detail(draft.id), 'stock-lines', draft.lineItems],
    queryFn: async ({ client }) =>
      fetchInventoryStockLines(
        { programId: draft.programId, facilityId: draft.facilityId },
        draft.lineItems,
        await client.ensureQueryData(inventorySummariesOptions(draft)),
      ),
  });

export const eligibleInventoryProductsOptions = (scope: InventoryScope) =>
  queryOptions({
    queryKey: queryKeys.physicalInventories.list({ ...scope, eligible: true }),
    queryFn: async ({ client }) =>
      fetchEligibleInventoryProducts(
        scope,
        await client.ensureQueryData(inventorySummariesOptions(scope)),
      ),
    staleTime: 5 * 60_000,
  });
