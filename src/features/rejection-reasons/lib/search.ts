import { z } from 'zod';
import { type DefaultSort, tableSearchSchema, textFilterSchema } from '@/lib/table-search';

export const CATEGORY_HIDEABLE_COLUMNS = [
  { id: 'code', labelKey: 'rejection-reason-categories.code', hideBelow: 'md' },
  { id: 'active', labelKey: 'rejection-reason-categories.active', hideBelow: 'sm' },
] as const;

export const DEFAULT_CATEGORIES_SORT: DefaultSort = { id: 'name', desc: false };

export const categoriesListSearchSchema = tableSearchSchema(['name', 'code', 'active']).extend({
  name: textFilterSchema,
});

export const categoriesSearchSchema = categoriesListSearchSchema.extend({
  category: z.literal('new').optional().catch(undefined),
});

export type CategoriesListSearch = z.infer<typeof categoriesListSearchSchema>;
export type CategoriesSearch = z.infer<typeof categoriesSearchSchema>;
