import { z } from 'zod';
import { type DefaultSort, tableSearchSchema } from '@/lib/table-search';

export const DEFAULT_DASHBOARD_REPORTS_SORT: DefaultSort = { id: 'name', desc: false };
const idSchema = z.guid().transform((id) => id.toLowerCase());

export const dashboardReportsSearchSchema = tableSearchSchema(['name', 'category']).extend({
  report: z
    .union([z.literal('new'), idSchema])
    .optional()
    .catch(undefined),
  delete: idSchema.optional().catch(undefined),
});

export type DashboardReportsSearch = z.infer<typeof dashboardReportsSearchSchema>;
