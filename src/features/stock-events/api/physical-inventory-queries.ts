import { queryOptions } from '@tanstack/react-query';
import {
  fetchEligibleInventoryProducts,
  fetchInventoryStockLines,
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

export const inventoryStockLinesOptions = (draft: PhysicalInventoryDraft) =>
  queryOptions({
    queryKey: [...queryKeys.physicalInventories.detail(draft.id), 'stock-lines', draft.lineItems],
    queryFn: () =>
      fetchInventoryStockLines(
        { programId: draft.programId, facilityId: draft.facilityId },
        draft.lineItems,
      ),
  });

export const eligibleInventoryProductsOptions = (scope: InventoryScope) =>
  queryOptions({
    queryKey: queryKeys.physicalInventories.list({ ...scope, eligible: true }),
    queryFn: () => fetchEligibleInventoryProducts(scope),
    staleTime: 5 * 60_000,
  });
