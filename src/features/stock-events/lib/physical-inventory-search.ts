import { z } from 'zod';
import { INVENTORY_PAGE_SIZE } from '@/features/stock-events/lib/physical-inventory-lines';
import { tableSearchSchema, textFilterSchema } from '@/lib/table-search';

export const inventorySearchSchema = tableSearchSchema(['id'])
  .pick({ page: true, size: true })
  .extend({
    keyword: textFilterSchema.transform((value) => value?.slice(0, 50)),
    includeInactive: z.boolean().optional().catch(undefined),
  })
  .transform((search) => ({
    ...search,
    page: search.page === 1 ? undefined : search.page,
    size: search.size === INVENTORY_PAGE_SIZE ? undefined : search.size,
    includeInactive: search.includeInactive || undefined,
  }));
export type InventorySearch = z.infer<typeof inventorySearchSchema>;
