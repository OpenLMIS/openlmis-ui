import { tableSearchSchema, textFilterSchema } from '@/lib/table-search';

export const stockEventSearchSchema = tableSearchSchema(['id'])
  .pick({ page: true, size: true })
  .extend({
    keyword: textFilterSchema,
  })
  .transform((search) => ({
    ...search,
    page: search.page === 1 ? undefined : search.page,
    size: search.size === 10 ? undefined : search.size,
  }));
