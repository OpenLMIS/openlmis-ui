import { type QueryClient, queryOptions } from '@tanstack/react-query';
import {
  fetchCatalogItems,
  fetchFacilityCce,
  fetchInventoryAlerts,
  fetchInventoryItem,
  fetchInventoryItems,
} from '@/features/cce-inventory/api/api';
import type { InventoryItem, InventoryQuery } from '@/features/cce-inventory/lib/types';
import { queryKeys } from '@/lib/key-factory';
import type { Page } from '@/lib/types';

export const inventoryItemsOptions = (query: InventoryQuery) =>
  queryOptions({
    queryKey: queryKeys.inventoryItems.list(query),
    queryFn: () => fetchInventoryItems(query),
  });

export const inventoryAlertsOptions = (deviceIds: readonly string[]) =>
  queryOptions({
    queryKey: [...queryKeys.inventoryItems.all, 'alerts', deviceIds],
    queryFn: () => fetchInventoryAlerts(deviceIds),
    enabled: deviceIds.length > 0,
  });

export const catalogItemsOptions = () =>
  queryOptions({
    queryKey: queryKeys.catalogItems.list(),
    queryFn: fetchCatalogItems,
  });

export const inventoryItemOptions = (id: string, opening: number) =>
  queryOptions({
    queryKey: [...queryKeys.inventoryItems.detail(id), opening],
    queryFn: () => fetchInventoryItem(id),
  });

export const listedInventoryItem = (queryClient: QueryClient, id: string) =>
  queryClient
    .getQueriesData<Page<InventoryItem>>({ queryKey: [...queryKeys.inventoryItems.all, 'list'] })
    .flatMap(([, page]) => page?.content ?? [])
    .find((item) => item.id === id);

export const facilityCceOptions = (facilityId: string) =>
  queryOptions({
    queryKey: [...queryKeys.inventoryItems.all, 'facility-cce', facilityId],
    queryFn: () => fetchFacilityCce(facilityId),
  });
