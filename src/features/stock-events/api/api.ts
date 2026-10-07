import type {
  EventStockCard,
  EventStockCardsFilter,
  StockEvent,
} from '@/features/stock-events/lib/types';
import { client } from '@/integrations/axios';
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
