import { describe, expect, it } from 'vitest';
import {
  cardPagingSchema,
  cardTableSearch,
  changeCardPaging,
} from '@/features/stock-card/lib/search';
import { tableSearchState } from '@/lib/table-search';

describe('card paging search', () => {
  it('validates card paging independently from the list paging', () => {
    expect(cardPagingSchema.parse({ cardPage: 3, cardSize: 20, page: 7 })).toEqual({
      cardPage: 3,
      cardSize: 20,
    });
    expect(cardPagingSchema.parse({ cardPage: -1, cardSize: 1001 })).toEqual({
      cardPage: undefined,
      cardSize: undefined,
    });
  });
  it('maps only card paging onto table state', () => {
    expect(cardTableSearch({ cardPage: 3, cardSize: 20 })).toEqual({ page: 3, size: 20 });
    expect(changeCardPaging({ cardPage: 3, cardSize: 20 }, () => ({ page: 4 }))).toEqual({
      cardPage: 4,
      cardSize: 20,
    });
  });
  it('uses the latest card paging for repeated updates and resets for a new size', () => {
    let search = { cardPage: 3 as number | undefined, cardSize: undefined as number | undefined };
    const state = tableSearchState({
      search: cardTableSearch(search),
      defaultSort: { id: 'date', desc: true },
      onSearchChange: (update) => {
        search = { ...search, ...changeCardPaging(search, update) };
      },
    });
    state.onPaginationChange((previous) => ({ ...previous, pageIndex: previous.pageIndex + 1 }));
    state.onPaginationChange((previous) => ({ ...previous, pageIndex: previous.pageIndex + 1 }));
    expect(search.cardPage).toBe(5);
    state.onPaginationChange((previous) => ({ ...previous, pageSize: 20 }));
    expect(search).toEqual({ cardPage: undefined, cardSize: 20 });
  });
});
