import { type Query, queryOptions } from '@tanstack/react-query';
import { orderablesByIdentitiesOptions } from '@/features/reference-data/api/queries';
import {
  fetchEligibleInventoryProducts,
  fetchInventoryStockLines,
  fetchInventorySummaries,
  fetchPhysicalInventoryDraft,
} from '@/features/stock-events/api/physical-inventory-api';
import { reconcileInventoryCopies } from '@/features/stock-events/lib/physical-inventory-local';
import type {
  InventoryScope,
  InventoryStockLine,
  InventorySummary,
  PhysicalInventoryDraft,
} from '@/features/stock-events/lib/physical-inventory-types';
import { queryKeys } from '@/lib/key-factory';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export const physicalInventoryDraftOptions = (scope: InventoryScope) =>
  queryOptions({
    queryKey: queryKeys.physicalInventories.list(scope),
    queryFn: async () => {
      const session = getSessionScope();
      const draft = await fetchPhysicalInventoryDraft(scope);
      assertSessionScope(session);
      await reconcileInventoryCopies(scope, draft?.id);
      return draft;
    },
  });

export const inventorySummariesOptions = (
  { programId, facilityId }: InventoryScope,
  updatedAfter = 0,
) =>
  queryOptions({
    queryKey: queryKeys.physicalInventories.list({ programId, facilityId, summaries: true }),
    queryFn: () => fetchInventorySummaries({ programId, facilityId }),
    staleTime: (query: Query<InventorySummary[]>) =>
      query.state.dataUpdatedAt < updatedAfter ? 0 : Infinity,
  });

export const inventoryStockLinesOptions = (draft: PhysicalInventoryDraft, updatedAfter = 0) =>
  queryOptions({
    queryKey: [...queryKeys.physicalInventories.detail(draft.id), 'stock-lines', draft.lineItems],
    staleTime: (query: Query<InventoryStockLine[]>) =>
      query.state.dataUpdatedAt < updatedAfter ? 0 : Infinity,
    queryFn: async ({ client }) => {
      const session = getSessionScope();
      const summaries = await client.fetchQuery(inventorySummariesOptions(draft, updatedAfter));
      assertSessionScope(session);
      return fetchInventoryStockLines(draft.lineItems, summaries, (identities) =>
        client.fetchQuery(orderablesByIdentitiesOptions(identities)),
      );
    },
  });

export const eligibleInventoryProductsOptions = (
  { programId, facilityId }: InventoryScope,
  updatedAfter = 0,
) =>
  queryOptions({
    queryKey: queryKeys.physicalInventoryProducts.list({ programId, facilityId }),
    queryFn: async ({ client }) => {
      const session = getSessionScope();
      const summaries = await client.fetchQuery(
        inventorySummariesOptions({ programId, facilityId }, updatedAfter),
      );
      assertSessionScope(session);
      return fetchEligibleInventoryProducts({ programId, facilityId }, summaries, (identities) =>
        client.fetchQuery(orderablesByIdentitiesOptions(identities)),
      );
    },
    staleTime: (query) =>
      query.state.fetchStatus === 'fetching' || query.state.dataUpdatedAt < updatedAfter
        ? 0
        : Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

export const inventoryRefreshFilters = (draft: PhysicalInventoryDraft) => [
  {
    queryKey: physicalInventoryDraftOptions({
      programId: draft.programId,
      facilityId: draft.facilityId,
    }).queryKey,
    exact: true,
  },
  { queryKey: inventorySummariesOptions(draft).queryKey, exact: true },
  { queryKey: [...queryKeys.physicalInventories.detail(draft.id), 'stock-lines'] },
];
