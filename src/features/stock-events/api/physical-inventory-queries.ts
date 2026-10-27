import { type InvalidateQueryFilters, type Query, queryOptions } from '@tanstack/react-query';
import { orderablesByIdentitiesOptions } from '@/features/reference-data/api/queries';
import {
  fetchEligibleInventoryProducts,
  fetchInventoryStockLines,
  fetchInventorySummaries,
  fetchPhysicalInventoryDraft,
} from '@/features/stock-events/api/physical-inventory-api';
import {
  type InventoryLocalCopy,
  type InventoryReference,
  readInventoryLocalByScope,
  readInventoryScope,
  reconcileInventoryCopies,
  requireInventoryReference,
} from '@/features/stock-events/lib/physical-inventory-local';
import type {
  InventoryScope,
  InventoryStockLine,
  InventorySummary,
  PhysicalInventoryDraft,
} from '@/features/stock-events/lib/physical-inventory-types';
import { deviceQuery } from '@/lib/device-query';
import { queryKeys } from '@/lib/key-factory';
import { isOnline } from '@/lib/online';
import { reportCaughtError } from '@/lib/report-error';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export const physicalInventoryDraftOptions = (scope: InventoryScope, online = isOnline()) =>
  deviceQuery({
    online,
    staleTime: 30_000,
    device: async (serverError): Promise<PhysicalInventoryDraft | null> => {
      const copy = await readInventoryLocalByScope(scope);
      if (!copy && serverError) throw serverError;
      return copy
        ? {
            id: copy.draftId,
            facilityId: copy.facilityId,
            programId: copy.programId,
            lineItems: [],
          }
        : null;
    },
    queryKey: queryKeys.physicalInventories.list(scope),
    server: async ({ client }) => {
      const requestedAt = Date.now();
      const session = getSessionScope();
      const draft = await fetchPhysicalInventoryDraft(scope);
      assertSessionScope(session);
      void reconcileInventoryCopies(scope, draft?.id, requestedAt)
        .catch((error) => reportCaughtError(error, {}))
        .then(() => {
          assertSessionScope(session);
          return client.invalidateQueries({
            queryKey: inventoryOrphansOptions(scope).queryKey,
            exact: true,
          });
        })
        .catch((error) => reportCaughtError(error, {}));
      return draft;
    },
  });

export const inventorySummariesOptions = (
  { programId, facilityId }: InventoryScope,
  updatedAfter = 0,
) =>
  queryOptions({
    queryKey: queryKeys.physicalInventories.list({ programId, facilityId, summaries: true }),
    queryFn: () => {
      return fetchInventorySummaries({ programId, facilityId });
    },
    staleTime: (query: Query<InventorySummary[]>) =>
      query.state.dataUpdatedAt < updatedAfter ? 0 : Infinity,
  });

export const inventoryStockLinesOptions = (draft: PhysicalInventoryDraft, updatedAfter = 0) =>
  queryOptions<InventoryStockLine[]>({
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
  queryOptions<InventoryStockLine[]>({
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

export const inventoryRefreshFilters = (
  draft: PhysicalInventoryDraft,
  includeDraft = true,
): InvalidateQueryFilters[] => [
  ...(includeDraft
    ? [
        {
          queryKey: physicalInventoryDraftOptions(
            {
              programId: draft.programId,
              facilityId: draft.facilityId,
            },
            true,
          ).queryKey,
          exact: true,
        },
      ]
    : []),
  { queryKey: inventorySummariesOptions(draft).queryKey, exact: true },
  { queryKey: [...queryKeys.physicalInventories.detail(draft.id), 'stock-lines'] },
];

export function inventoryDeviceOptions(copy: InventoryLocalCopy) {
  const options = {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  };
  const key = [
    ...queryKeys.physicalInventories.detail(copy.draftId),
    'device',
    copy.generation,
    copy.revision,
    copy.savedAt,
  ];
  const referenceOptions = queryOptions<InventoryReference>({
    ...options,
    queryKey: [...key, 'reference'],
    queryFn: () => requireInventoryReference(copy),
  });
  return {
    eligible: queryOptions<InventoryStockLine[]>({
      ...options,
      queryKey: [...key, 'eligible'],
      queryFn: async ({ client }) => (await client.fetchQuery(referenceOptions)).eligible,
    }),
    reasons: queryOptions<InventoryReference['reasons']>({
      ...options,
      queryKey: [...key, 'reasons'],
      queryFn: async ({ client }) => (await client.fetchQuery(referenceOptions)).reasons,
    }),
  };
}

export const inventoryOrphansOptions = (scope: InventoryScope) =>
  queryOptions({
    queryKey: queryKeys.physicalInventories.list({ ...scope, orphaned: true }),
    queryFn: async () => (await readInventoryScope(scope)).filter((copy) => copy.orphaned),
  });
