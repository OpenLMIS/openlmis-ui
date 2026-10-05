import type { z } from 'zod';
import { type DefaultSort, tableSearchSchema, textFilterSchema } from '@/lib/table-search';

/** View menu columns in display order; the name is left out, so it always shows. */
export const REASON_HIDEABLE_COLUMNS = [
  { id: 'category', labelKey: 'reasons.category', hideBelow: 'lg' },
  { id: 'type', labelKey: 'reasons.type', hideBelow: 'md' },
  { id: 'freeText', labelKey: 'reasons.free-text', hideBelow: 'xl' },
] as const;

const REASON_SORT_FIELDS = ['name', 'category', 'type'] as const;

export type ReasonSortField = (typeof REASON_SORT_FIELDS)[number];

export const DEFAULT_REASONS_SORT: DefaultSort = { id: 'name', desc: false };

export const reasonsSearchSchema = tableSearchSchema(REASON_SORT_FIELDS).extend({
  q: textFilterSchema,
});

export type ReasonsSearch = z.infer<typeof reasonsSearchSchema>;

export const CLEARED_REASON_FILTERS = {
  q: undefined,
  page: undefined,
} satisfies Partial<ReasonsSearch>;

export function hasReasonFilters(search: ReasonsSearch) {
  return Boolean(search.q);
}
