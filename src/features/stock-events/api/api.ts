import { fetchLotsByIds, fetchOrderablesByIds } from '@/features/reference-data/api/api';
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
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import type { Page } from '@/lib/types';

type SummaryCard = {
  stockCard: { id: string };
  orderable: { id: string };
  lot: { id: string } | null;
  stockOnHand: number;
};

export async function fetchEventStockCards(
  filter: EventStockCardsFilter,
): Promise<EventStockCard[]> {
  const scope = getSessionScope();
  const { data } = await client.get<{ content: { canFulfillForMe: SummaryCard[] }[] }>(
    '/v2/stockCardSummaries',
    {
      params: { ...filter, nonEmptyOnly: true },
    },
  );
  assertSessionScope(scope);
  const unique = new Map<string, SummaryCard>();
  for (const summary of data.content) {
    for (const card of summary.canFulfillForMe) {
      if (!unique.has(card.stockCard.id)) unique.set(card.stockCard.id, card);
    }
  }
  const cards = [...unique.values()];
  const orderableIds = cards.map((card) => card.orderable.id);
  const lotIds = cards.flatMap((card) => (card.lot ? [card.lot.id] : []));
  const [orderables, lots] = await Promise.all([
    fetchOrderablesByIds(orderableIds),
    fetchLotsByIds(lotIds),
  ]);
  assertSessionScope(scope);
  const orderablesById = new Map(orderables.map((orderable) => [orderable.id, orderable]));
  const lotsById = new Map(lots.map((lot) => [lot.id, lot]));
  return cards.map((card) => {
    const orderable = orderablesById.get(card.orderable.id);
    const lot = card.lot ? lotsById.get(card.lot.id) : null;
    if (!orderable || (card.lot && !lot)) throw new Error('Stock card product or lot not found');
    return { id: card.stockCard.id, stockOnHand: card.stockOnHand, orderable, lot: lot ?? null };
  });
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
