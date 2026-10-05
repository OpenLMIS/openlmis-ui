import { toLotRows } from '@/features/lots/lib/lot-rows';
import type { Lot, LotsQuery } from '@/features/lots/lib/types';
import { fetchOrderablesByTradeItems } from '@/features/reference-data/api/api';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

export async function fetchLotRows(query: LotsQuery) {
  const { data } = await client.get<Page<Lot>>('/lots', { params: query });
  const tradeItemIds = [...new Set(data.content.map((lot) => lot.tradeItemId))];
  const orderables = await fetchOrderablesByTradeItems(tradeItemIds);
  return { ...data, content: toLotRows(data.content, orderables) };
}

export async function fetchLot(id: string) {
  const { data } = await client.get<Lot>(`/lots/${id}`);
  return data;
}

/** The server builds the lot from the body alone, so the whole record goes back. */
export async function updateLot(lot: Lot) {
  const { data } = await client.put<Lot>(`/lots/${lot.id}`, lot);
  return data;
}
