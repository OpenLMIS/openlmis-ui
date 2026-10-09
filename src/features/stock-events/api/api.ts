import { stockKey } from '@/features/stock-events/lib/event-reverse';
import type {
  EventStockCard,
  EventStockCardsFilter,
  EventStockOnHand,
  EventStockOnHandFilter,
  EventStockSummary,
  PageQuery,
  StockEvent,
  StockEventCancel,
  StockEventLine,
  StockEventSummary,
  StockEventsQuery,
} from '@/features/stock-events/lib/types';
import { client } from '@/integrations/axios';
import { fetchReport } from '@/lib/fetch-report';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
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
  const { data } = await client.get<Page<StockEventLine> & { last?: boolean }>(
    `/stockEvents/${id}/lineItems`,
    {
      params: query,
    },
  );
  return data;
}

export async function fetchStockEventReport(
  id: string,
  params: { showInDoses: boolean; lang: string },
) {
  return fetchReport(`/stockEvents/${id}/print`, params);
}

export async function cancelStockEvent(id: string, body: StockEventCancel): Promise<string> {
  const { data } = await client.post<string | { id: string }>(`/stockEvents/${id}/cancel`, body);
  return typeof data === 'string' ? data : data.id;
}

export async function fetchAllStockEventLines(id: string): Promise<StockEventLine[]> {
  const scope = getSessionScope();
  const lines: StockEventLine[] = [];
  for (let page = 0; ; page += 1) {
    assertSessionScope(scope);
    const data = await fetchStockEventLines(id, { page, size: 2000 });
    assertSessionScope(scope);
    lines.push(...data.content);
    if (data.last ?? page + 1 >= data.totalPages) break;
  }
  return lines;
}

export async function fetchEventStockOnHand({
  programId,
  facilityId,
  orderableIds,
}: EventStockOnHandFilter): Promise<EventStockOnHand> {
  const scope = getSessionScope();
  const ids = [...new Set(orderableIds)];
  const stock: EventStockOnHand = {};
  for (let start = 0; start < ids.length; start += 100) {
    const batch = ids.slice(start, start + 100);
    for (let page = 0; ; page += 1) {
      assertSessionScope(scope);
      const { data } = await client.get<Page<EventStockSummary>>('/v2/stockCardSummaries', {
        params: { programId, facilityId, orderableId: batch, page, size: 100 },
        paramsSerializer: { indexes: null },
      });
      assertSessionScope(scope);
      for (const summary of data.content) {
        for (const entry of summary.canFulfillForMe) {
          stock[stockKey(entry.orderable.id, entry.lot?.id)] = entry.stockOnHand;
        }
      }
      if (page + 1 >= data.totalPages) break;
    }
  }
  return stock;
}
