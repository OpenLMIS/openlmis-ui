import type { z } from 'zod';
import { type DefaultSort, tableSearchSchema } from '@/lib/table-search';

export const DEFAULT_PREPARED_SORT: DefaultSort = { id: 'targetYear', desc: false };

export const prepareSearchSchema = tableSearchSchema(['targetYear']);

export type PrepareSearch = z.infer<typeof prepareSearchSchema>;
