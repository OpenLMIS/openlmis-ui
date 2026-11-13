import type { z } from 'zod';
import { type DefaultSort, type SearchChange, tableSearchSchema } from '@/lib/table-search';

export const DEFAULT_BUQ_SORT: DefaultSort = { id: 'targetYear', desc: false };

export const buqListSearchSchema = tableSearchSchema(['targetYear']).omit({
  sort: true,
  dir: true,
});

export type BuqListSearch = z.infer<typeof buqListSearchSchema>;

export type BuqTableProps = {
  search: BuqListSearch;
  onSearchChange: SearchChange<BuqListSearch>;
  cards: boolean;
};

export type BuqListProps = Omit<BuqTableProps, 'cards'>;
