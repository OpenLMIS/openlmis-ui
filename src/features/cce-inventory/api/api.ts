import type {
  CatalogItem,
  InventoryAlert,
  InventoryItem,
  InventoryItemBody,
  InventoryItemRecord,
  InventoryItemUpdate,
  InventoryQuery,
} from '@/features/cce-inventory/lib/types';
import { client } from '@/integrations/axios';
import { fetchReport } from '@/lib/fetch-report';
import type { Page } from '@/lib/types';

export async function fetchInventoryItems(query: InventoryQuery) {
  const { data } = await client.get<Page<InventoryItem>>('/inventoryItems', {
    params: { ...query, expand: 'lastModifier' },
    paramsSerializer: { indexes: null },
  });
  return data;
}

export async function fetchInventoryAlerts(deviceIds: readonly string[]) {
  const { data } = await client.get<Page<InventoryAlert>>('/cceAlerts', {
    params: { deviceId: deviceIds },
    paramsSerializer: { indexes: null },
  });
  return data.content;
}

export async function fetchCatalogItems() {
  const { data } = await client.get<Page<CatalogItem>>('/catalogItems', {
    params: { archived: false, visibleInCatalog: true },
  });
  return data.content;
}

export async function createInventoryItem(body: InventoryItemBody) {
  await client.post('/inventoryItems', body);
}

export async function fetchInventoryItem(id: string) {
  const { data } = await client.get<InventoryItemRecord>(`/inventoryItems/${id}`, {
    params: { expand: 'lastModifier' },
  });
  return data;
}

export async function updateInventoryItem(item: InventoryItemUpdate) {
  await client.put(`/inventoryItems/${item.id}`, item);
}

export function exportInventoryItems(facilityId: string, programId: string) {
  return fetchReport('/inventoryItems/download', { format: 'csv', facilityId, programId });
}
