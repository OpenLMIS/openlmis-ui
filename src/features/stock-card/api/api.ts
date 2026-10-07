import { isAxiosError } from 'axios';
import type { StockCard } from '@/features/stock-card/lib/types';
import { client } from '@/integrations/axios';

export async function fetchStockCard(id: string) {
  const { data } = await client.get<StockCard>(`/stockCards/${id}`);
  return data;
}

export async function fetchStockCardReport(
  id: string,
  params: { showInDoses: boolean; lang: string },
) {
  try {
    const { data } = await client.get<Blob>(`/stockCards/${id}/print`, {
      params,
      responseType: 'blob',
    });
    return data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await error.response.data.text());
      } catch {
        error.response.data = undefined;
      }
    }
    throw error;
  }
}
