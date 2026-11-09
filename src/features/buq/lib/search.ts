import type { z } from 'zod';
import { type DefaultSort, tableSearchSchema } from '@/lib/table-search';

export const DEFAULT_BUQ_SORT: DefaultSort = { id: 'targetYear', desc: false };

export const buqListSearchSchema = tableSearchSchema(['targetYear']);

export type BuqListSearch = z.infer<typeof buqListSearchSchema>;
