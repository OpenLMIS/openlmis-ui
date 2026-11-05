import { queryOptions } from '@tanstack/react-query';
import {
  fetchCatalogItems,
  fetchInventoryAlerts,
  fetchInventoryItem,
  fetchInventoryItems,
} from '@/features/cce-inventory/api/api';
import type { InventoryQuery } from '@/features/cce-inventory/lib/types';
import { queryKeys } from '@/lib/key-factory';

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
