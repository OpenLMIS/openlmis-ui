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
  category: z
    .union([z.literal('new'), z.guid()])
    .optional()
    .catch(undefined),
});

export type CategoriesListSearch = z.infer<typeof categoriesListSearchSchema>;
export type CategoriesSearch = z.infer<typeof categoriesSearchSchema>;

export const REJECTION_REASON_HIDEABLE_COLUMNS = [
  { id: 'code', labelKey: 'rejection-reasons.code', hideBelow: 'md' },
  { id: 'category', labelKey: 'rejection-reasons.category', hideBelow: 'xl' },
  { id: 'active', labelKey: 'rejection-reasons.active', hideBelow: 'sm' },
] as const;

export const DEFAULT_REJECTION_REASONS_SORT: DefaultSort = { id: 'name', desc: false };

export const rejectionReasonsListSearchSchema = tableSearchSchema([
  'name',
  'code',
  'category',
  'active',
]).extend({
  name: textFilterSchema,
});

export const rejectionReasonsSearchSchema = rejectionReasonsListSearchSchema.extend({
  reason: z
    .union([z.literal('new'), z.guid()])
    .optional()
    .catch(undefined),
});

export type RejectionReasonsListSearch = z.infer<typeof rejectionReasonsListSearchSchema>;
export type RejectionReasonsSearch = z.infer<typeof rejectionReasonsSearchSchema>;
