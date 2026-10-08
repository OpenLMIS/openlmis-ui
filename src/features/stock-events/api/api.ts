import type {
  PageQuery,
  StockEventLine,
  StockEventSummary,
  StockEventsQuery,
} from '@/features/stock-events/lib/types';
import { client } from '@/integrations/axios';
import { fetchReport } from '@/lib/fetch-report';
import type { Page } from '@/lib/types';

export async function fetchStockEvents(query: StockEventsQuery) {
  const { data } = await client.get<Page<StockEventSummary>>('/stockEvents', { params: query });
  return data;
}

export async function fetchStockEvent(id: string) {
  const { data } = await client.get<StockEventSummary>(`/stockEvents/${id}`);
  return data;
}

export async function fetchStockEventLines(id: string, query: PageQuery) {
  const { data } = await client.get<Page<StockEventLine>>(`/stockEvents/${id}/lineItems`, {
    params: query,
  });
  return data;
}

export async function fetchStockEventReport(
  id: string,
  params: { showInDoses: boolean; lang: string },
) {
  return fetchReport(`/stockEvents/${id}/print`, params);
}
