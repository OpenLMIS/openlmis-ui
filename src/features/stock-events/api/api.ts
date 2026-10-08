import type {
  EventStockCard,
  EventStockCardsFilter,
  PageQuery,
  StockEvent,
  StockEventLine,
  StockEventSummary,
  StockEventsQuery,
} from '@/features/stock-events/lib/types';
import { client } from '@/integrations/axios';
import { fetchReport } from '@/lib/fetch-report';
import type { Page } from '@/lib/types';

export async function fetchEventStockCards({
  programId,
  facilityId,
}: EventStockCardsFilter): Promise<EventStockCard[]> {
  const cards: EventStockCard[] = [];
  for (let page = 0; ; page += 1) {
    const { data } = await client.get<Page<EventStockCard>>('/stockCardSummaries', {
      params: { program: programId, facility: facilityId, page, size: 100 },
    });
    cards.push(...data.content);
    if (page + 1 >= data.totalPages) break;
  }
  return cards;
}

export async function submitStockEvent(body: StockEvent): Promise<string> {
  const { data } = await client.post<string>('/stockEvents', body);
  return data;
}

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
