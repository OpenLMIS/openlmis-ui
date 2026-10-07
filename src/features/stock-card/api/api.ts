import type { StockCard } from '@/features/stock-card/lib/types';
import { client } from '@/integrations/axios';
import { fetchReport } from '@/lib/fetch-report';

export async function fetchStockCard(id: string) {
  const { data } = await client.get<StockCard>(`/stockCards/${id}`);
  return data;
}

export async function fetchStockCardReport(
  id: string,
  params: { showInDoses: boolean; lang: string },
) {
  return fetchReport(`/stockCards/${id}/print`, params);
}
