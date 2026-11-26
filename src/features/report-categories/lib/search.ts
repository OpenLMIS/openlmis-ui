import { z } from 'zod';
import type { ReportCategoriesQuery } from '@/features/report-categories/lib/types';
import {
  type DefaultSort,
  tableSearchSchema,
  toPaginationState,
  toSortParam,
} from '@/lib/table-search';

export const DEFAULT_REPORT_CATEGORIES_SORT: DefaultSort = { id: 'name', desc: false };

const idSchema = z.guid().transform((id) => id.toLowerCase());

export const reportCategoriesSearchSchema = tableSearchSchema(['name']).extend({
  category: z
    .union([z.literal('new'), idSchema])
    .optional()
    .catch(undefined),
  delete: idSchema.optional().catch(undefined),
});

export type ReportCategoriesSearch = z.infer<typeof reportCategoriesSearchSchema>;

export function toReportCategoriesQuery(search: ReportCategoriesSearch): ReportCategoriesQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  return {
    page: pageIndex,
    size: pageSize,
    sort: toSortParam(search, DEFAULT_REPORT_CATEGORIES_SORT),
  };
}
