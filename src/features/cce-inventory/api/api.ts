import type {
  InventoryAlert,
  InventoryItem,
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

export function exportInventoryItems(facilityId: string, programId: string) {
  return fetchReport('/inventoryItems/download', { format: 'csv', facilityId, programId });
}
