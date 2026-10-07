import { z } from 'zod';
import { type SearchUpdate, type TableSearch, tableSearchSchema } from '@/lib/table-search';

const paging = tableSearchSchema(['date']);
export const cardPagingSchema = z.object({
  cardPage: paging.shape.page,
  cardSize: paging.shape.size,
});
export type CardPagingSearch = z.infer<typeof cardPagingSchema>;

export const cardTableSearch = (search: CardPagingSearch): TableSearch => ({
  page: search.cardPage,
  size: search.cardSize,
});

export function changeCardPaging(
  previous: CardPagingSearch,
  update: Partial<TableSearch> | SearchUpdate<TableSearch>,
): CardPagingSearch {
  const current = cardTableSearch(previous);
  const next = { ...current, ...(typeof update === 'function' ? update(current) : update) };
  return { cardPage: next.page, cardSize: next.size };
}
