import type {
  CatalogItem,
  InventoryAlert,
  InventoryItem,
  InventoryItemBody,
  InventoryItemRecord,
  InventoryQuery,
} from '@/features/cce-inventory/lib/types';
import { client } from '@/integrations/axios';
import { fetchReport } from '@/lib/fetch-report';
import type { Page } from '@/lib/types';

const ALERT_HISTORY_TEMPLATE = '5ccbdfe1-594f-4830-960d-801dabf36566';

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

export async function updateInventoryItem(item: InventoryItemRecord) {
  await client.put(`/inventoryItems/${item.id}`, item);
}

export async function transferInventoryItem(
  id: string,
  target: { facilityId: string; programId: string; yearOfInstallation: number },
) {
  await client.put(`/inventoryItems/${id}/transfer`, { id, ...target });
}

export async function dismissAlert(alert: InventoryAlert) {
  await client.put('/cceAlerts', { ...alert, dismissed: true });
}

export function fetchAlertHistory(inventoryItemId: string, lang: string) {
  return fetchReport(`/reports/templates/common/${ALERT_HISTORY_TEMPLATE}/pdf`, {
    inventoryItemId,
    lang,
  });
}

export function exportInventoryItems(facilityId: string, programId: string) {
  return fetchReport('/inventoryItems/download', { format: 'csv', facilityId, programId });
}
