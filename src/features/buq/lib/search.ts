import { z } from 'zod';
import { type DefaultSort, type SearchChange, tableSearchSchema } from '@/lib/table-search';

export const DEFAULT_BUQ_SORT: DefaultSort = { id: 'targetYear', desc: false };

export const buqListSearchSchema = tableSearchSchema(['targetYear']).omit({
  sort: true,
  dir: true,
});

export type BuqListSearch = z.infer<typeof buqListSearchSchema>;

export const nationalSearchSchema = buqListSearchSchema.extend({
  zone: z.string().optional().catch(undefined),
  period: z.string().optional().catch(undefined),
});

export type NationalSearch = z.infer<typeof nationalSearchSchema>;

export type BuqTableProps = {
  search: BuqListSearch;
  onSearchChange: SearchChange<BuqListSearch>;
  cards: boolean;
};

export type BuqListProps = Omit<BuqTableProps, 'cards'>;

export const FORECAST_SORT: DefaultSort = { id: 'product', desc: false };

export const forecastSearchSchema = tableSearchSchema(['product']).extend({
  dialog: z.enum(['funding', 'rejection', 'reject']).optional().catch(undefined),
});

export type ForecastSearch = z.infer<typeof forecastSearchSchema>;

export const FORECAST_DIALOGS: Partial<ForecastSearch> = { dialog: undefined };

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: extending the router's type needs interface merging.
  interface HistoryState {
    buqListSearch?: BuqListSearch;
  }
}
