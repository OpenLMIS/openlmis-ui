import { z } from 'zod';
import { EVENT_TYPES, type StockEventsQuery } from '@/features/stock-events/lib/types';
import { facilityProgramSearchSchema } from '@/lib/facility-program-selection';
import {
  dateFilterSchema,
  type SearchUpdate,
  type TableSearch,
  tableSearchSchema,
  textFilterSchema,
  toPaginationState,
} from '@/lib/table-search';

const paging = tableSearchSchema(['date']).omit({ sort: true, dir: true });

export const transactionHistorySearchSchema = paging.extend({
  ...facilityProgramSearchSchema.shape,
  type: z.enum(EVENT_TYPES).optional().catch(undefined),
  startDate: dateFilterSchema,
  endDate: dateFilterSchema,
  documentNumber: textFilterSchema,
});

export type TransactionHistorySearch = z.infer<typeof transactionHistorySearchSchema>;

type EventFilters = Pick<
  TransactionHistorySearch,
  'type' | 'startDate' | 'endDate' | 'documentNumber'
>;

export const CLEARED_EVENT_FILTERS = {
  type: undefined,
  startDate: undefined,
  endDate: undefined,
  documentNumber: undefined,
  page: undefined,
} satisfies Partial<TransactionHistorySearch>;

export const hasEventFilters = (search: EventFilters) =>
  Boolean(search.type || search.startDate || search.endDate || search.documentNumber);

/** `yyyy-MM-dd` values compare as text. */
export const invalidDateRange = ({ startDate, endDate }: EventFilters) =>
  Boolean(startDate && endDate && endDate < startDate);

export function toEventsQuery(
  search: EventFilters & TableSearch,
  { facilityId, programId }: { facilityId: string; programId: string },
): StockEventsQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  const documentNumber = search.documentNumber?.trim();
  return {
    facilityId,
    programId,
    page: pageIndex,
    size: pageSize,
    ...(search.type && { type: search.type }),
    ...(search.startDate && { startDate: search.startDate }),
    ...(search.endDate && { endDate: search.endDate }),
    ...(documentNumber && { documentNumber }),
  };
}

export const detailPagingSchema = z.object({
  detailPage: paging.shape.page,
  detailSize: paging.shape.size,
});
export type DetailPagingSearch = z.infer<typeof detailPagingSchema>;

export const detailTableSearch = (search: DetailPagingSearch): TableSearch => ({
  page: search.detailPage,
  size: search.detailSize,
});

export function changeDetailPaging(
  previous: DetailPagingSearch,
  update: Partial<TableSearch> | SearchUpdate<TableSearch>,
): DetailPagingSearch {
  const current = detailTableSearch(previous);
  const next = { ...current, ...(typeof update === 'function' ? update(current) : update) };
  return { detailPage: next.page, detailSize: next.size };
}
