import {
  BUQ_CATALOGS,
  type BuqCatalogTab,
  type BuqCatalogWrite,
} from '@/features/buq-admin/lib/types';
import type { BuqCatalogRecord } from '@/features/reference-data/lib/types';
import { client } from '@/integrations/axios';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export async function fetchCatalogRecord(tab: BuqCatalogTab, id: string, signal: AbortSignal) {
  const { data } = await client.get<BuqCatalogRecord>(`${BUQ_CATALOGS[tab].path}/${id}`, {
    signal,
  });
  return data;
}

export async function createCatalogRecord(tab: BuqCatalogTab, body: BuqCatalogWrite) {
  const { data } = await client.post<BuqCatalogRecord>(BUQ_CATALOGS[tab].path, body);
  return data;
}

export async function updateCatalogRecord(tab: BuqCatalogTab, id: string, body: BuqCatalogWrite) {
  const url = `${BUQ_CATALOGS[tab].path}/${id}`;
  if (tab === 'sources') {
    const scope = getSessionScope();
    await client.get<BuqCatalogRecord>(url, { sessionScope: scope });
    assertSessionScope(scope);
  }
  const { data } = await client.put<BuqCatalogRecord>(url, { id, ...body });
  return data;
}

export function deleteCatalogRecord(tab: BuqCatalogTab, id: string) {
  return client.delete(`${BUQ_CATALOGS[tab].path}/${id}`);
}
